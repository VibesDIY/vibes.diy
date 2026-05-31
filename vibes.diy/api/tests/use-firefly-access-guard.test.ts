import { describe, expect, it } from "vitest";
import { useFireproof } from "../../vibe/runtime/use-firefly.js";

describe("useFireproof access config runtime guard", () => {
  it("throws explicit phase-3 message when config.access is provided", () => {
    const access = () => ({ allowAnonymous: true });

    expect(() => useFireproof("access-guard-test", { access })).toThrowError(/config\.access is not enforced yet[\s\S]*Phase 3/);
  });
});
