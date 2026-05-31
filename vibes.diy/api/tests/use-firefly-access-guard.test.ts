import { describe, expect, it } from "vitest";
import { useFireproof } from "../../vibe/runtime/use-firefly.js";

describe("useFireproof access config (Phase 3)", () => {
  it("does not throw when config.access is provided", () => {
    const access = () => ({ allowAnonymous: true });
    expect(() => useFireproof("access-phase3-test", { access })).not.toThrow();
  });
});
