import { beforeAll, describe, expect, it, inject } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { getVibeOgTitle, parseVibePathname } from "@vibes.diy/api-svc/intern/get-vibe-og-title.js";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

// Minimal valid Apps row — only the fields needed for getVibeOgTitle.
function makeAppsRow(overrides: {
  appSlug: string;
  userSlug: string;
  meta: unknown;
  mode?: "dev" | "production";
  releaseSeq?: number;
}) {
  return {
    userId: "test-user",
    fsId: "bafytest",
    env: [],
    fileSystem: [],
    created: new Date().toISOString(),
    mode: overrides.mode ?? "production",
    releaseSeq: overrides.releaseSeq ?? 1,
    ...overrides,
  };
}

describe("parseVibePathname", () => {
  it("extracts slugs from a canonical /vibe/:user/:app path", () => {
    const result = parseVibePathname("/vibe/jchris/my-cool-app");
    expect(result).toEqual({ userSlug: "jchris", appSlug: "my-cool-app" });
  });

  it("extracts slugs when path has additional segments", () => {
    const result = parseVibePathname("/vibe/jchris/my-cool-app/some-fsid");
    expect(result).toEqual({ userSlug: "jchris", appSlug: "my-cool-app" });
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

describe("getVibeOgTitle", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 5000 }, () => {
  const sthis = ensureSuperThis();
  let vibesCtx: VibesApiSQLCtx;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vibesCtx = appCtx.vibesCtx;
  });

  it("returns the title from the MetaTitle item", async () => {
    const appSlug = `og-titled-${sthis.nextId(6).str}`;
    const userSlug = `og-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db
      .insert(vibesCtx.sql.tables.apps)
      .values(makeAppsRow({ appSlug, userSlug, meta: [{ type: "title", title: "My Beautiful App" }] }));

    const result = await getVibeOgTitle(vibesCtx, { userSlug, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBe("My Beautiful App");
  });

  it("returns undefined when app has no MetaTitle item", async () => {
    const appSlug = `og-notitle-${sthis.nextId(6).str}`;
    const userSlug = `og-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db
      .insert(vibesCtx.sql.tables.apps)
      .values(makeAppsRow({ appSlug, userSlug, meta: [{ type: "screen-shot-ref", assetUrl: "x", mime: "image/jpeg" }] }));

    const result = await getVibeOgTitle(vibesCtx, { userSlug, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBeUndefined();
  });

  it("returns undefined when app does not exist", async () => {
    const result = await getVibeOgTitle(vibesCtx, { userSlug: "no-such-user", appSlug: "no-such-app" });
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBeUndefined();
  });

  it("returns undefined for dev-mode rows (only production mode is checked)", async () => {
    const appSlug = `og-dev-${sthis.nextId(6).str}`;
    const userSlug = `og-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db
      .insert(vibesCtx.sql.tables.apps)
      .values(makeAppsRow({ appSlug, userSlug, meta: [{ type: "title", title: "Dev Title" }], mode: "dev" }));

    const result = await getVibeOgTitle(vibesCtx, { userSlug, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBeUndefined();
  });

  it("returns the most recent production title when multiple releases exist", async () => {
    const appSlug = `og-multi-${sthis.nextId(6).str}`;
    const userSlug = `og-user-${sthis.nextId(6).str}`;
    await vibesCtx.sql.db
      .insert(vibesCtx.sql.tables.apps)
      .values([
        makeAppsRow({ appSlug, userSlug, meta: [{ type: "title", title: "Old Title" }], releaseSeq: 1 }),
        makeAppsRow({ appSlug, userSlug, meta: [{ type: "title", title: "New Title" }], releaseSeq: 2 }),
      ]);

    const result = await getVibeOgTitle(vibesCtx, { userSlug, appSlug });
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBe("New Title");
  });
});
