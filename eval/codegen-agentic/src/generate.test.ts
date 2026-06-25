import { describe, it, expect } from "vitest";
import { shouldAbortPreflight } from "./generate.js";

describe("shouldAbortPreflight", () => {
  it("aborts on a non-transient errored smoke cell", () => {
    expect(shouldAbortPreflight({ exitState: "errored", transient: false })).toBe(true);
  });
  it("continues on a transient errored smoke cell", () => {
    expect(shouldAbortPreflight({ exitState: "errored", transient: true })).toBe(false);
  });
  it("continues on a successful smoke cell", () => {
    expect(shouldAbortPreflight({ exitState: "ok" })).toBe(false);
  });
});
