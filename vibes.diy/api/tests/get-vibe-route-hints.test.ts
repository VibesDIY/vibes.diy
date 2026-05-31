import { beforeAll, describe, expect, inject, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";
import {
  deriveIsWorldReadable,
  getVibeRouteHints,
  parseVibePathname,
  vibePathnameHasFsId,
} from "@vibes.diy/api-svc/intern/get-vibe-route-hints.js";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

describe("deriveIsWorldReadable", () => {
  it("returns false for null/undefined/non-array", () => {
    expect(deriveIsWorldReadable(null)).toBe(false);
    expect(deriveIsWorldReadable(undefined)).toBe(false);
    expect(deriveIsWorldReadable("string")).toBe(false);
    expect(deriveIsWorldReadable({})).toBe(false);
  });

  it("returns false for empty entries array", () => {
    expect(deriveIsWorldReadable([])).toBe(false);
  });

  it("returns true when app.public.access enable:true is present", () => {
    expect(deriveIsWorldReadable([{ type: "app.public.access", enable: true }])).toBe(true);
  });

  it("returns false when app.public.access enable:false", () => {
    expect(deriveIsWorldReadable([{ type: "app.public.access", enable: false }])).toBe(false);
  });

  it("returns true when app.request has autoAcceptRole", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true, autoAcceptRole: "viewer" }])).toBe(true);
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true, autoAcceptRole: "editor" }])).toBe(true);
  });

  it("returns false when app.request enable:true but no autoAcceptRole", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: true }])).toBe(false);
  });

  it("returns false when app.request has autoAcceptRole but enable:false", () => {
    expect(deriveIsWorldReadable([{ type: "app.request", enable: false, autoAcceptRole: "viewer" }])).toBe(false);
  });

  it("latest entry wins — false overrides earlier true for publicAccess", () => {
    expect(
      deriveIsWorldReadable([
        { type: "app.public.access", enable: true },
        { type: "app.public.access", enable: false },
      ])
    ).toBe(false);
  });

  it("latest entry wins — true overrides earlier false for publicAccess", () => {
    expect(
      deriveIsWorldReadable([
        { type: "app.public.access", enable: false },
        { type: "app.public.access", enable: true },
      ])
    ).toBe(true);
  });

  it("ignores unrelated entry types", () => {
    expect(
      deriveIsWorldReadable([
        { type: "active.title", title: "My App" },
        { type: "active.theme", theme: "dark" },
      ])
    ).toBe(false);
  });
});

// Minimal valid Apps row — only the fields needed for getVibeRouteHints.
function makeAppsRow(overrides: {
  appSlug: string;
  ownerHandle: string;
  meta: unknown;
  mode?: "dev" | "production";
  releaseSeq?: number;
}) {
  return {
    userId: "test-user-hints",
    fsId: `bafyhints${Math.random().toString(36).slice(2, 10)}`,
    env: [],
    fileSystem: [],
    created: new Date().toISOString(),
    mode: overrides.mode ?? "production",
    releaseSeq: overrides.releaseSeq ?? 1,
    ...overrides,
  };
}

describe("getVibeRouteHints", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();
  let vibesCtx: VibesApiSQLCtx;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vibesCtx = appCtx.vibesCtx;
  });

  it("returns ogTitle from MetaTitle and isWorldReadable:false when no AppSettings row", async () => {
    const appSlug = `hints-notitle-${sthis.nextId(6).str}`;
    const ownerHandle = `hints-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db
      .insert(vibesCtx.sql.tables.apps)
      .values(makeAppsRow({ appSlug, ownerHandle, meta: [{ type: "title", title: "My App" }] }));

    const result = await getVibeRouteHints(vibesCtx, { ownerHandle, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok().ogTitle).toBe("My App");
    expect(result.Ok().isWorldReadable).toBe(false);
  });

  it("returns isWorldReadable:true when AppSettings has publicAccess enable:true", async () => {
    const appSlug = `hints-pub-${sthis.nextId(6).str}`;
    const ownerHandle = `hints-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db.insert(vibesCtx.sql.tables.apps).values(makeAppsRow({ appSlug, ownerHandle, meta: [] }));
    await vibesCtx.sql.db.insert(vibesCtx.sql.tables.appSettings).values({
      userId: "test-user-hints",
      appSlug,
      ownerHandle,
      settings: [{ type: "app.public.access", enable: true }],
      updated: new Date().toISOString(),
      created: new Date().toISOString(),
    });

    const result = await getVibeRouteHints(vibesCtx, { ownerHandle, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok().isWorldReadable).toBe(true);
  });

  it("returns isWorldReadable:true when AppSettings has enableRequest autoAcceptRole", async () => {
    const appSlug = `hints-auto-${sthis.nextId(6).str}`;
    const ownerHandle = `hints-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db.insert(vibesCtx.sql.tables.apps).values(makeAppsRow({ appSlug, ownerHandle, meta: [] }));
    await vibesCtx.sql.db.insert(vibesCtx.sql.tables.appSettings).values({
      userId: "test-user-hints",
      appSlug,
      ownerHandle,
      settings: [{ type: "app.request", enable: true, autoAcceptRole: "viewer" }],
      updated: new Date().toISOString(),
      created: new Date().toISOString(),
    });

    const result = await getVibeRouteHints(vibesCtx, { ownerHandle, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok().isWorldReadable).toBe(true);
  });

  it("returns isWorldReadable:false when enableRequest has no autoAcceptRole", async () => {
    const appSlug = `hints-req-${sthis.nextId(6).str}`;
    const ownerHandle = `hints-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db.insert(vibesCtx.sql.tables.apps).values(makeAppsRow({ appSlug, ownerHandle, meta: [] }));
    await vibesCtx.sql.db.insert(vibesCtx.sql.tables.appSettings).values({
      userId: "test-user-hints",
      appSlug,
      ownerHandle,
      settings: [{ type: "app.request", enable: true }],
      updated: new Date().toISOString(),
      created: new Date().toISOString(),
    });

    const result = await getVibeRouteHints(vibesCtx, { ownerHandle, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok().isWorldReadable).toBe(false);
  });

  it("returns {ogTitle:undefined, isWorldReadable:false} for unknown slugs", async () => {
    const result = await getVibeRouteHints(vibesCtx, { ownerHandle: "nobody", appSlug: "nothing" });
    expect(result.isOk()).toBe(true);
    expect(result.Ok().ogTitle).toBeUndefined();
    expect(result.Ok().isWorldReadable).toBe(false);
  });
});

describe("parseVibePathname", () => {
  it("extracts slugs from a canonical /vibe/:user/:app path", () => {
    expect(parseVibePathname("/vibe/jchris/my-cool-app")).toEqual({ ownerHandle: "jchris", appSlug: "my-cool-app" });
  });

  it("extracts slugs when path has additional segments", () => {
    expect(parseVibePathname("/vibe/jchris/my-cool-app/some-fsid")).toEqual({ ownerHandle: "jchris", appSlug: "my-cool-app" });
  });

  it("returns undefined for non-vibe paths", () => {
    expect(parseVibePathname("/")).toBeUndefined();
    expect(parseVibePathname("/api/foo")).toBeUndefined();
    expect(parseVibePathname("/reports")).toBeUndefined();
  });

  it("returns undefined for /vibe with missing slugs", () => {
    expect(parseVibePathname("/vibe")).toBeUndefined();
    expect(parseVibePathname("/vibe/")).toBeUndefined();
    expect(parseVibePathname("/vibe/jchris")).toBeUndefined();
    expect(parseVibePathname("/vibe/jchris/")).toBeUndefined();
  });
});

describe("vibePathnameHasFsId", () => {
  it("returns false for canonical 3-segment vibe paths", () => {
    expect(vibePathnameHasFsId("/vibe/jchris/my-app")).toBe(false);
  });

  it("returns true when a 4th (fsId) segment is present", () => {
    expect(vibePathnameHasFsId("/vibe/jchris/my-app/bafyabc123")).toBe(true);
  });

  it("returns false for non-vibe paths even with 4+ segments", () => {
    expect(vibePathnameHasFsId("/api/foo/bar/baz")).toBe(false);
  });

  it("returns false when 4th segment is empty", () => {
    expect(vibePathnameHasFsId("/vibe/jchris/my-app/")).toBe(false);
  });
});
