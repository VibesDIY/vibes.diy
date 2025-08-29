import { describe, it, expect } from "vitest";
import { fireproof } from "use-fireproof";

describe("use-fireproof mock", () => {
  it("should have fireproof export available", () => {
    expect(fireproof).toBeDefined();
    expect(typeof fireproof).toBe("function");
  });
});
