import { describe, expect, it } from "vitest";
import { formatErr } from "./format-err.js";

describe("formatErr", () => {
  it("returns strings verbatim (no quotes)", () => {
    expect(formatErr("Authentication required")).toBe("Authentication required");
  });

  it("unwraps standard Error to its message", () => {
    expect(formatErr(new Error("boom"))).toBe("boom");
  });

  it("formats vibes.diy res-error envelope with code prefix", () => {
    const err = {
      type: "vibes.diy.res-error",
      error: { message: "Authentication required", code: "authentication_required" },
    };
    expect(formatErr(err)).toBe("[authentication_required] Authentication required");
  });

  it("formats vibes.diy res-error without code as bare message", () => {
    const err = { type: "vibes.diy.res-error", error: { message: "boom" } };
    expect(formatErr(err)).toBe("boom");
  });

  it("falls back to JSON for unknown object shapes (never [object Object])", () => {
    expect(formatErr({ foo: 1, bar: "baz" })).toBe('{"foo":1,"bar":"baz"}');
  });

  it("renders null and undefined as their literal strings", () => {
    expect(formatErr(null)).toBe("null");
    expect(formatErr(undefined)).toBe("undefined");
  });

  it("never produces the literal '[object Object]'", () => {
    const cases: unknown[] = [
      "string-err",
      new Error("err-message"),
      { type: "vibes.diy.res-error", error: { message: "envelope" } },
      { unknown: "shape" },
      null,
      undefined,
      42,
    ];
    for (const c of cases) {
      expect(formatErr(c)).not.toBe("[object Object]");
    }
  });
});
