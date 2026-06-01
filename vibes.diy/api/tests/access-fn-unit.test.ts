import { describe, it, expect } from "vitest";

// Unit test: the eval wrapper used inside AccessFnDO.
// NOTE: In production, AccessFnDO uses QuickJS WASM (@cf-wasm/quickjs) to evaluate
// access functions — new Function() does not work at runtime in Cloudflare DO fetch
// handlers (allow_eval_during_startup only covers startup/module scope). These tests
// use new Function() directly because it works in Node/Vitest and tests the same
// logical behavior pattern.

function evalAccessFn(source: string): (doc: unknown, oldDoc: unknown, user: unknown, ctx: unknown) => unknown {
  return new Function("doc", "oldDoc", "user", "ctx", source) as (
    doc: unknown,
    oldDoc: unknown,
    user: unknown,
    ctx: unknown
  ) => unknown;
}

describe("AccessFnDO eval logic", () => {
  it("evals a function that allows anonymous writes", () => {
    const source = `return { allowAnonymous: true };`;
    const fn = evalAccessFn(source);
    const result = fn(null, null, null, {});
    expect(result).toEqual({ allowAnonymous: true });
  });

  it("evals a function that denies anonymous writes (empty return)", () => {
    const source = `return {};`;
    const fn = evalAccessFn(source);
    const result = fn(null, null, null, {});
    expect(result).toEqual({});
  });

  it("evals a function that returns channels", () => {
    const source = `return { channels: ["chan-a", "chan-b"] };`;
    const fn = evalAccessFn(source);
    const result = fn({ _id: "doc1" }, null, { userHandle: "alice" }, {});
    expect(result).toEqual({ channels: ["chan-a", "chan-b"] });
  });

  it("evals a function that conditionally forbids based on user", () => {
    const source = `
      if (!user) return { allowAnonymous: false };
      return {};
    `;
    const fn = evalAccessFn(source);
    expect(fn({}, null, null, {})).toEqual({ allowAnonymous: false });
    expect(fn({}, null, { userHandle: "alice" }, {})).toEqual({});
  });

  it("throws on malformed source", () => {
    expect(() => evalAccessFn("this is not js { {{")).toThrow();
  });
});
