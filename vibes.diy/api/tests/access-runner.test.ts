import { describe, it, expect } from "vitest";
import { extractExportSource } from "../../vibe/runtime/access-extract.js";
import { makeClientCtx, evaluateWrite, canSeeDoc } from "../../vibe/runtime/access-runner.js";

function forbiddenOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "forbidden" in err) {
    return String((err as { forbidden: unknown }).forbidden);
  }
  return undefined;
}

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
    } catch (e: unknown) {
      expect(forbiddenOf(e)).toBe("authentication required");
    }
  });

  it("signed-in non-member fails with 'not in channel: X'", () => {
    const ctx = makeClientCtx({ userHandle: "a", isOwner: false }, grants, false);
    expect(() => ctx.requireAccess("ops")).toThrow();
    try {
      ctx.requireAccess("ops");
    } catch (e: unknown) {
      expect(forbiddenOf(e)).toBe("not in channel: ops");
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

const G = { channels: ["board"], publicChannels: [], roles: [] };
const ownerOnly = `export function db(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (!user.isOwner) throw { forbidden: "owner only" };
  return { channels: ["board"], grant: { public: ["board"] } };
}`;

describe("evaluateWrite", () => {
  it("owner → ok", () => {
    const v = evaluateWrite({
      source: ownerOnly,
      dbName: "db",
      doc: { type: "tile" },
      oldDoc: null,
      user: { userHandle: "o", isOwner: true },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: true });
  });

  it("signed-in non-owner → owner only", () => {
    const v = evaluateWrite({
      source: ownerOnly,
      dbName: "db",
      doc: { type: "tile" },
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: false, reason: "owner only", code: "access-denied" });
  });

  it("anon → sign in (the access fn's own throw)", () => {
    const v = evaluateWrite({
      source: ownerOnly,
      dbName: "db",
      doc: { type: "tile" },
      oldDoc: null,
      user: null,
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: false, reason: "sign in", code: "access-denied" });
  });

  it("anon + no allowAnonymous → authentication required (enforceAllowAnonymous)", () => {
    const src = `export function db(doc, oldDoc, user, ctx) { return { channels: ["c"] }; }`;
    const v = evaluateWrite({ source: src, dbName: "db", doc: {}, oldDoc: null, user: null, grants: G, adminMode: false });
    expect(v).toEqual({ ok: false, reason: "authentication required", code: "access-denied" });
  });

  it("zero-channel result → unreadable", () => {
    const src = `export function db(doc, oldDoc, user, ctx) { return {}; }`;
    const v = evaluateWrite({
      source: src,
      dbName: "db",
      doc: {},
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ ok: false, reason: "unreadable write", code: "unreadable" });
  });

  it("missing export → unknown", () => {
    const v = evaluateWrite({
      source: `export function other(){}`,
      dbName: "db",
      doc: {},
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ unknown: true, reason: "access function not found" });
  });

  it("async access fn → unknown", () => {
    const src = `export function db(doc, oldDoc, user, ctx) { return Promise.resolve({ channels: ["c"] }); }`;
    const v = evaluateWrite({
      source: src,
      dbName: "db",
      doc: {},
      oldDoc: null,
      user: { userHandle: "x", isOwner: false },
      grants: G,
      adminMode: false,
    });
    expect(v).toEqual({ unknown: true, reason: "async access function" });
  });
});

describe("canSeeDoc", () => {
  const grants = { channels: ["board"], publicChannels: ["news"], roles: [] };
  const outputs = new Map<string, string[]>([
    ["d1", ["board"]],
    ["d2", ["secret"]],
    ["d3", ["news"]],
  ]);

  it("true when a stored channel is in effective grants", () => {
    expect(canSeeDoc({ doc: { _id: "d1" }, outputChannels: outputs, grants, adminOverride: false })).toBe(true);
  });
  it("true via public channel", () => {
    expect(canSeeDoc({ doc: { _id: "d3" }, outputChannels: outputs, grants, adminOverride: false })).toBe(true);
  });
  it("false when no stored channel intersects", () => {
    expect(canSeeDoc({ doc: { _id: "d2" }, outputChannels: outputs, grants, adminOverride: false })).toBe(false);
  });
  it("false when the doc has no stored channels", () => {
    expect(canSeeDoc({ doc: { _id: "dX" }, outputChannels: outputs, grants, adminOverride: false })).toBe(false);
  });
  it("true under adminOverride regardless of channels", () => {
    expect(canSeeDoc({ doc: { _id: "dX" }, outputChannels: outputs, grants, adminOverride: true })).toBe(true);
  });
  it("true when there are NO outputs at all (undefined) — server cold-start pass-through", () => {
    expect(canSeeDoc({ doc: { _id: "dX" }, outputChannels: undefined, grants, adminOverride: false })).toBe(true);
  });
  it("true when the output map is empty — server cold-start pass-through", () => {
    expect(canSeeDoc({ doc: { _id: "dX" }, outputChannels: new Map(), grants, adminOverride: false })).toBe(true);
  });
});
