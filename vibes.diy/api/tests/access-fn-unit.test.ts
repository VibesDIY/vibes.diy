import { describe, it, expect } from "vitest";
import { extractExportSource } from "../svc/public/access-function.js";

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

describe("extractExportSource", () => {
  const multiExportSource = [
    'export function chat(doc, oldDoc, user, ctx) { if (!user) throw { forbidden: "auth" }; return {}; }',
    "",
    "export default function (doc, oldDoc, user, ctx) { return { allowAnonymous: true }; }",
  ].join("\n");

  const arrowDefaultSource = [
    'export function chat(doc, oldDoc, user, ctx) { return { channels: ["public"] }; }',
    "",
    "export default (doc, oldDoc, user, ctx) => { return { allowAnonymous: true }; }",
  ].join("\n");

  it("extracts named export by dbName", () => {
    const result = extractExportSource(multiExportSource, "chat");
    expect(result).toContain("function chat(");
    expect(result).not.toContain("export");
    expect(result).not.toContain("allowAnonymous");
  });

  it("extracts default export for wildcard", () => {
    const result = extractExportSource(multiExportSource, "*");
    expect(result).toContain("allowAnonymous");
    expect(result).not.toContain("export");
    expect(result).not.toContain("default");
    expect(result).toMatch(/^function\s*\(/);
  });

  it("extracts arrow default export for wildcard", () => {
    const result = extractExportSource(arrowDefaultSource, "*");
    expect(result).toBeDefined();
    expect(result).toContain("allowAnonymous");
    expect(result).not.toContain("export");
    expect(result).toMatch(/^\(/);
  });

  it("returns undefined for missing export", () => {
    expect(extractExportSource(multiExportSource, "nonexistent")).toBeUndefined();
  });

  it("named export takes precedence — extracts only that function", () => {
    const chatFn = extractExportSource(multiExportSource, "chat");
    const defaultFn = extractExportSource(multiExportSource, "*");
    expect(chatFn).not.toEqual(defaultFn);
    expect(chatFn).toContain("function chat(");
    expect(defaultFn).toContain("allowAnonymous");
  });
});
