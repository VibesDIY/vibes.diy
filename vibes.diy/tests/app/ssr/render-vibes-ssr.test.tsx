// SSR-safety regression for the vibe render path (#2802, slice 1).
//
// `renderVibeToString` runs server-side — inside the worker/isolate that has no
// `window`. This runs in node env (no `globalThis.window`) and asserts the
// render succeeds, mirroring vibe-route-ssr.test.tsx. If a change reintroduces a
// synchronous `window`/`document` reference into the vibe provider chain, this
// throws and fails.

import React from "react";
import { describe, it, expect } from "vitest";
import { renderVibeToString } from "../../../vibe/runtime/render-vibes.js";

describe("renderVibeToString — server context", () => {
  it("globalThis.window is undefined in this test (node env)", () => {
    expect(typeof globalThis.window).toBe("undefined");
  });

  it("server-renders a simple vibe component without touching window", () => {
    const App = () => React.createElement("main", null, "ssr-ok");
    const html = renderVibeToString([App], { usrEnv: {} });
    expect(html).toContain("ssr-ok");
  });
});
