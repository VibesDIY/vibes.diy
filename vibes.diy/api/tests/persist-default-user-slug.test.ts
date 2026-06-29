import { beforeAll, describe, expect, it } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import { createTestDeviceCA } from "@fireproof/core-device-id";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";
import { persistDefaultUserSlug } from "../svc/intern/ensure-slug-binding.js";
import { resolveActiveHandle } from "../svc/public/resolve-active-handle.js";
import type { VibesApiSQLCtx } from "@vibes.diy/api-svc";

// #2695: a fresh authenticated user with no UserSettings row can have several
// whoAmI RPCs reach persistDefaultUserSlug concurrently. A plain select-then-
// insert lets the loser of the race hit the userId primary-key conflict and
// throw, which would reject resolveWhoAmI and leave first-load identity flaky.
// persistDefaultUserSlug must be idempotent under concurrency.
describe("persistDefaultUserSlug concurrency", { timeout: 30000 }, () => {
  const sthis = ensureSuperThis();
  let vctx: VibesApiSQLCtx;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    const appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    vctx = appCtx.vibesCtx;
    const now = new Date().toISOString();
    // Bind the handle so resolveActiveHandle can confirm the persisted default.
    await vctx.sql.db
      .insert(vctx.sql.tables.handleBinding)
      .values([{ userId: "u-race", handle: "race-handle", tenant: "t-race", created: now }]);
  });

  it("does not throw when called concurrently for a user with no settings row", async () => {
    // All writers observe no settings row, then race the insert. Without the
    // onConflictDoNothing guard the loser throws a PK conflict.
    const results = await Promise.allSettled(new Array(5).fill(0).map(() => persistDefaultUserSlug(vctx, "u-race", "race-handle")));
    for (const r of results) {
      expect(r.status).toBe("fulfilled");
    }
    // The default is persisted and resolves to the bound handle.
    expect(await resolveActiveHandle(vctx, "u-race")).toBe("race-handle");
  });
});
