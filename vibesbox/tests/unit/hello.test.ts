import { describe, expect, it } from "vitest";

describe("Vibesbox Hello World", () => {
  it("should pass a basic test", () => {
    expect(true).toBe(true);
  });

  it("should perform basic math", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle strings", () => {
    const message = "Hello from Vibesbox!";
    expect(message).toContain("Vibesbox");
    expect(message).toHaveLength(20);
  });
});
