// Behavioral tests for the SSR render + hydrate contract (#2802, slice 1).
//
// `renderVibeToString` is the server counterpart to `mountVibe`: it must build
// the SAME provider-wrapped tree so the client can hydrate the server markup
// instead of throwing it away. These run in the browser project (real DOM), so
// they exercise the actual `hydrateRoot` vs `createRoot` decision.

import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountVibe, unmountVibe } from "@vibes.diy/vibe-runtime";
// Deep-import the server renderer: it pulls in `react-dom/server` and must stay
// off the client root entry (see render-vibes.ts / index.ts).
import { renderVibeToString } from "../../vibe/runtime/render-vibes.js";

beforeEach(() => {
  unmountVibe();
  document.body.innerHTML = "";
});
afterEach(() => {
  unmountVibe();
});

describe("renderVibeToString", () => {
  it("renders a component's output to an HTML string", () => {
    const App = () => React.createElement("div", null, "hello-ssr");
    const html = renderVibeToString([App], { usrEnv: {} });
    expect(html).toContain("hello-ssr");
  });

  it("renders every component in order (Fragment of comps)", () => {
    const A = () => React.createElement("span", null, "alpha");
    const B = () => React.createElement("span", null, "beta");
    const html = renderVibeToString([A, B], { usrEnv: {} });
    expect(html.indexOf("alpha")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("beta")).toBeGreaterThan(html.indexOf("alpha"));
  });

  it("rejects invalid mount params", () => {
    const App = () => null;
    // missing required `usrEnv`
    expect(() => renderVibeToString([App], { nope: true } as unknown)).toThrow();
  });
});

describe("mountVibe hydration of SSR markup", () => {
  it("hydrates pre-existing server markup instead of re-creating the DOM", async () => {
    document.body.innerHTML = '<div class="vibe-app-container"></div>';
    const container = document.querySelector(".vibe-app-container") as HTMLElement;

    // The effect fires only after React commits hydration — a deterministic
    // signal to wait on, instead of racing concurrent hydration with a timer.
    let hydrated = false;
    const App = () => {
      React.useEffect(() => {
        hydrated = true;
      }, []);
      return React.createElement("button", { type: "button" }, "count");
    };
    // Server render goes into the container exactly as the worker would inject it.
    container.innerHTML = renderVibeToString([App], { usrEnv: {} });
    const serverButton = container.querySelector("button") as HTMLButtonElement;

    // Client mount must hydrate (reuse the node), not blow it away with createRoot.
    mountVibe([App], { usrEnv: {} });
    await vi.waitFor(() => expect(hydrated).toBe(true));

    // Same node reference after mount ⇒ React hydrated the server DOM. A
    // createRoot().render() would have discarded it and built a fresh button.
    expect(container.querySelector("button")).toBe(serverButton);
  });

  it("still client-renders into an empty container", async () => {
    document.body.innerHTML = '<div class="vibe-app-container"></div>';
    const container = document.querySelector(".vibe-app-container") as HTMLElement;
    expect(container.hasChildNodes()).toBe(false);

    const App = () => React.createElement("div", null, "fresh-render");
    mountVibe([App], { usrEnv: {} });

    await vi.waitFor(() => expect(container.textContent).toContain("fresh-render"));
  });
});
