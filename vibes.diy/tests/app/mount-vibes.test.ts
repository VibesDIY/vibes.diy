import { describe, it, expect } from "vitest";
import { mountVibe, unmountVibe } from "@vibes.diy/vibe-runtime";

describe("mountVibe / unmountVibe", () => {
  it("unmountVibe is a no-op when nothing was mounted", () => {
    expect(() => unmountVibe()).not.toThrow();
  });

  it("re-mounts after unmount without throwing", () => {
    document.body.innerHTML = '<div class="vibe-app-container"></div>';
    const App = () => null;
    mountVibe([App], { usrEnv: {} });
    unmountVibe();
    mountVibe([App], { usrEnv: {} });
    unmountVibe();
  });
});
