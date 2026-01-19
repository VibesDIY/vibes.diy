import { describe, it, expect } from "vitest";
import { useVibes } from "use-vibes";

describe("useVibes - Import Test", () => {
  it("should be importable from use-vibes package", () => {
    expect(typeof useVibes).toBe("function");
  });
});
