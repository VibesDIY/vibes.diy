import { describe, it, expect } from "vitest";
import { extractExportSource } from "../../vibe/runtime/access-extract.js";
import { makeClientCtx } from "../../vibe/runtime/access-runner.js";

describe("extractExportSource (runtime port)", () => {
  it("extracts a named export by db name", () => {
    const src = `export function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`;
    const out = extractExportSource(src, "notes");
    expect(out).toBe(`function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`);
  });

  it("extracts a default export for '*'", () => {
    const src = `export default function (doc) { return {}; }`;
    expect(extractExportSource(src, "*")).toBe(`function (doc) { return {}; }`);
  });

  it("returns undefined when the named export is absent", () => {
    const src = `export function other(doc) { return {}; }`;
    expect(extractExportSource(src, "notes")).toBeUndefined();
  });
});

describe("makeClientCtx", () => {
  const grants = { channels: ["eng"], publicChannels: [], roles: ["mod"] };

  it("anon fails requireAccess with 'authentication required' (before membership)", () => {
    const ctx = makeClientCtx(null, grants, false);
    expect(() => ctx.requireAccess("eng")).toThrow();
    try {
      ctx.requireAccess("eng");
    } catch (e: any) {
      expect(e.forbidden).toBe("authentication required");
    }
  });

  it("signed-in non-member fails with 'not in channel: X'", () => {
    const ctx = makeClientCtx({ userHandle: "a", isOwner: false }, grants, false);
    try {
      ctx.requireAccess("ops");
    } catch (e: any) {
      expect(e.forbidden).toBe("not in channel: ops");
    }
  });

  it("member passes requireAccess and requireRole", () => {
    const ctx = makeClientCtx({ userHandle: "a", isOwner: false }, grants, false);
    expect(() => ctx.requireAccess("eng")).not.toThrow();
    expect(() => ctx.requireRole("mod")).not.toThrow();
  });

  it("adminMode bypasses both checks even for anon", () => {
    const ctx = makeClientCtx(null, { channels: [], publicChannels: [], roles: [] }, true);
    expect(() => ctx.requireAccess("anything")).not.toThrow();
    expect(() => ctx.requireRole("anything")).not.toThrow();
  });
});
