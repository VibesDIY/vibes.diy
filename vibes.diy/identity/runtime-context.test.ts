import { describe, it, expect } from "vitest";
import { ensureRuntimeContext } from "./runtime-context.js";

describe("ensureRuntimeContext", () => {
  it("returns a stable singleton exposing env + nextId", () => {
    const a = ensureRuntimeContext();
    const b = ensureRuntimeContext();
    expect(a).toBe(b);
    expect(typeof a.nextId().str).toBe("string");
    expect(a.nextId().str).not.toBe(a.nextId().str);
  });
});
