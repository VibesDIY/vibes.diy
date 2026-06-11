import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { resolveActiveHandle } from "../svc/public/resolve-active-handle.js";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";

// resolveActiveHandle is the single source of truth for "which handle is this
// userId acting as": the defaultHandle setting wins, falling back to a bound
// handle. Both who-am-i (viewer payload) and the document write path must use
// it so they cannot diverge for a multi-handle user (the cause of spurious
// "not author" rejections — see VibesDIY/vibes.diy#2275).
describe("resolveActiveHandle", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vctx: VibesApiSQLCtx;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = appCtx.vibesCtx;
    const now = new Date().toISOString();

    // Multi-handle user: "alpha" is inserted first, so a bare unordered
    // limit(1) returns it — but the user's chosen default is "beta".
    await vctx.sql.db.insert(vctx.sql.tables.handleBinding).values([
      { userId: "u-multi", handle: "alpha-handle", tenant: "t-alpha", created: now },
      { userId: "u-multi", handle: "beta-handle", tenant: "t-beta", created: now },
    ]);
    await vctx.sql.db.insert(vctx.sql.tables.userSettings).values({
      userId: "u-multi",
      settings: [{ type: "defaultHandle", ownerHandle: "beta-handle" }],
      updated: now,
      created: now,
    });

    // Single-handle user with no settings row at all → fallback path.
    await vctx.sql.db
      .insert(vctx.sql.tables.handleBinding)
      .values([{ userId: "u-single", handle: "solo-handle", tenant: "t-solo", created: now }]);

    // Impersonation guard: a defaultHandle the user does NOT own (ensureUserSettings
    // validates shape, not ownership) must not be returned — fall back to an owned one.
    await vctx.sql.db
      .insert(vctx.sql.tables.handleBinding)
      .values([{ userId: "u-spoof", handle: "real-handle", tenant: "t-real", created: now }]);
    await vctx.sql.db.insert(vctx.sql.tables.userSettings).values({
      userId: "u-spoof",
      settings: [{ type: "defaultHandle", ownerHandle: "victim-handle" }],
      updated: now,
      created: now,
    });
  });

  it("prefers the defaultHandle setting over an arbitrary handleBinding row", async () => {
    expect(await resolveActiveHandle(vctx, "u-multi")).toBe("beta-handle");
  });

  it("falls back to a bound handle when no defaultHandle setting exists", async () => {
    expect(await resolveActiveHandle(vctx, "u-single")).toBe("solo-handle");
  });

  it("returns undefined for a user with no handles", async () => {
    expect(await resolveActiveHandle(vctx, "u-none")).toBeUndefined();
  });

  it("ignores a defaultHandle the user does not own and falls back to a bound handle", async () => {
    expect(await resolveActiveHandle(vctx, "u-spoof")).toBe("real-handle");
  });
});
