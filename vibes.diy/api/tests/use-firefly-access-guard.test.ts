import { describe, expect, it } from "vitest";
import { useFireproof } from "../../vibe/runtime/use-firefly.js";

describe("useFireproof access config (Phase 3)", () => {
  it("does not throw access-not-supported when config.access is provided", () => {
    const access = () => ({ allowAnonymous: true });
    let threwAccessError = false;
    try {
      useFireproof("access-phase3-test", { access });
    } catch (err: unknown) {
      // React hook context errors are expected outside a component — only
      // flag errors that mention "access" to verify the Phase 2/3 guard was removed.
      if (err instanceof Error && /access/i.test(err.message)) {
        threwAccessError = true;
      }
    }
    expect(threwAccessError).toBe(false);
  });
});
