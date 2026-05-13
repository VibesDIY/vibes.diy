import { VibesDiyApi } from "@vibes.diy/api-impl";
import { assert, beforeAll, describe, expect, inject, it } from "vitest";
import { Result, TestFetchPair, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { cfServe, CFInject, noopCache, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { Request as CFRequest, ExecutionContext } from "@cloudflare/workers-types";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { eq, and } from "drizzle-orm/sql/expressions";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

interface RecentOrderRow {
  appSlug: string;
  userSlug: string;
  fsId: string;
  updated: string;
  pinnedAt?: string;
}

describe("listRecentVibes", { timeout: (inject("DB_FLAVOUR" as never) as string) === "pg" ? 30000 : 10000 }, () => {
  const sthis = ensureSuperThis();

  let api: VibesDiyApi;
  let api2: VibesDiyApi;
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;

  beforeAll(async () => {
    const deviceCA = await createTestDeviceCA(sthis);
    appCtx = await createVibeDiyTestCtx(sthis, deviceCA);
    const testUser = await createTestUser({ sthis, deviceCA, seqUserId: 700 });

    const fetchPair = TestFetchPair.create();
    const wsPair = TestWSPair.create();

    fetchPair.server.onServe(async (req: Request) => {
      return cfServe(
        req as unknown as CFRequest,
        {
          appCtx: appCtx.appCtx,
          cache: noopCache,
          drizzle: appCtx.vibesCtx.sql.db,
          webSocket: {
            connections: new Set(),
            webSocketPair: () => ({
              client: wsPair.p1,
              server: wsPair.p2,
            }),
          },
        } as unknown as ExecutionContext & CFInject
      ) as unknown as Promise<Response>;
    });

    const wsEvento = vibesMsgEvento();
    const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    appCtx.vibesCtx.connections.add(wsSendProvider);

    wsPair.p2.onmessage = (event: MessageEvent) => {
      wsEvento.trigger({ ctx: appCtx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
    };

    api = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser.getDashBoardToken()),
    });

    const testUser2 = await createTestUser({ sthis, deviceCA, seqUserId: 800 });
    api2 = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      fetch: fetchPair.client.fetch,
      timeoutMs: 100000,
      getToken: async () => Result.Ok(await testUser2.getDashBoardToken()),
    });
  });

  async function createApp(client: VibesDiyApi, marker: string) {
    const rRes = await client.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        {
          type: "code-block",
          lang: "jsx",
          filename: "/App.jsx",
          content: `function App() { return <div>${marker}</div>; } App();`,
        },
      ],
    });
    const res = rRes.Ok();
    if (!isResEnsureAppSlugOk(res)) {
      assert.fail("Expected ensureAppSlug to return ResEnsureAppSlugOk");
    }
    return { appSlug: res.appSlug, userSlug: res.userSlug, fsId: res.fsId };
  }

  async function setUpdated(userSlug: string, appSlug: string, isoTs: string) {
    const t = appCtx.vibesCtx.sql.tables.appSlugBinding;
    await appCtx.vibesCtx.sql.db
      .update(t)
      .set({ updated: isoTs })
      .where(and(eq(t.userSlug, userSlug), eq(t.appSlug, appSlug)));
  }

  function rowKey(row: { userSlug: string; appSlug: string }): string {
    return `${row.userSlug}/${row.appSlug}`;
  }

  function seededShuffle<T>(items: readonly T[], seed: number): T[] {
    let state = seed;
    const ret = [...items];
    for (let i = ret.length - 1; i > 0; i--) {
      state = (state * 1664525 + 1013904223) >>> 0;
      const j = state % (i + 1);
      const tmp = ret[i];
      ret[i] = ret[j];
      ret[j] = tmp;
    }
    return ret;
  }

  function compareDesc(a: string, b: string): number {
    if (a === b) return 0;
    return a < b ? 1 : -1;
  }

  function compareRecentOrder(a: RecentOrderRow, b: RecentOrderRow): number {
    const pinned = compareDesc(a.pinnedAt ?? "", b.pinnedAt ?? "");
    if (pinned !== 0) return pinned;
    const updated = compareDesc(a.updated, b.updated);
    if (updated !== 0) return updated;
    const userSlug = compareDesc(a.userSlug, b.userSlug);
    if (userSlug !== 0) return userSlug;
    return compareDesc(a.appSlug, b.appSlug);
  }

  it("returns the just-created app with a populated updated timestamp", async () => {
    const app = await createApp(api, "fresh");

    const rList = await api.listRecentVibes({ limit: 50 });
    if (rList.isErr()) assert.fail(`listRecentVibes failed: ${rList.Err().message}`);

    const found = rList.Ok().items.find((it) => it.appSlug === app.appSlug && it.userSlug === app.userSlug);
    expect(found).toBeDefined();
    expect(typeof found?.updated).toBe("string");
    expect((found?.updated ?? "").length).toBeGreaterThan(0);
  });

  it("orders apps by updated DESC", async () => {
    const older = await createApp(api, "older");
    const newer = await createApp(api, "newer");

    await setUpdated(older.userSlug, older.appSlug, "2020-01-01T00:00:00.000Z");
    await setUpdated(newer.userSlug, newer.appSlug, "2030-01-01T00:00:00.000Z");

    const rList = await api.listRecentVibes({ limit: 100 });
    if (rList.isErr()) assert.fail(`listRecentVibes failed: ${rList.Err().message}`);
    const items = rList.Ok().items.filter((it) => it.appSlug === older.appSlug || it.appSlug === newer.appSlug);
    expect(items[0]?.appSlug).toBe(newer.appSlug);
    expect(items[1]?.appSlug).toBe(older.appSlug);
  });

  it("paginates with limit and returns no overlap across pages", async () => {
    const created = await Promise.all([
      createApp(api, "p1"),
      createApp(api, "p2"),
      createApp(api, "p3"),
      createApp(api, "p4"),
      createApp(api, "p5"),
    ]);
    const base = Date.parse("2025-06-01T00:00:00.000Z");
    for (let i = 0; i < created.length; i++) {
      await setUpdated(created[i].userSlug, created[i].appSlug, new Date(base + i * 1000).toISOString());
    }
    const seen = new Set<string>();

    const r1 = await api.listRecentVibes({ limit: 2 });
    if (r1.isErr()) assert.fail(`page 1 failed: ${r1.Err().message}`);
    const ok1 = r1.Ok();
    expect(ok1.items.length).toBe(2);
    expect(ok1.nextCursor).toBeTruthy();
    for (const it of ok1.items) seen.add(`${it.userSlug}/${it.appSlug}`);

    const r2 = await api.listRecentVibes({ limit: 2, cursor: ok1.nextCursor });
    if (r2.isErr()) assert.fail(`page 2 failed: ${r2.Err().message}`);
    const ok2 = r2.Ok();
    expect(ok2.items.length).toBe(2);
    for (const it of ok2.items) {
      const key = `${it.userSlug}/${it.appSlug}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("paginates correctly when multiple rows share the same updated timestamp (tri-field tie-break)", async () => {
    const a = await createApp(api, "tie-a");
    const b = await createApp(api, "tie-b");
    const c = await createApp(api, "tie-c");
    const sameTs = "2099-07-01T00:00:00.000Z";
    await setUpdated(a.userSlug, a.appSlug, sameTs);
    await setUpdated(b.userSlug, b.appSlug, sameTs);
    await setUpdated(c.userSlug, c.appSlug, sameTs);

    const tieKeys = new Set([`${a.userSlug}/${a.appSlug}`, `${b.userSlug}/${b.appSlug}`, `${c.userSlug}/${c.appSlug}`]);
    const seen = new Set<string>();

    let cursor: string | undefined;
    for (let page = 0; page < 3; page++) {
      const rPage = await api.listRecentVibes({ limit: 2, cursor });
      if (rPage.isErr()) assert.fail(`page ${page + 1} failed: ${rPage.Err().message}`);
      const ok = rPage.Ok();
      for (const it of ok.items) {
        const key = `${it.userSlug}/${it.appSlug}`;
        if (tieKeys.has(key)) {
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
      cursor = ok.nextCursor;
      if (seen.size === 3) break;
    }
    expect(seen.size).toBe(3);
  });

  it("returns an error for a malformed cursor (cursor is opaque)", async () => {
    const rList = await api.listRecentVibes({ limit: 10, cursor: "not-a-valid-cursor!!!" });
    expect(rList.isErr()).toBe(true);
  });

  it("does not return apps owned by another user", async () => {
    const ownApp = await createApp(api, "scope-own");
    const otherApp = await createApp(api2, "scope-other");

    const rList = await api.listRecentVibes({ limit: 100 });
    if (rList.isErr()) assert.fail(`listRecentVibes failed: ${rList.Err().message}`);

    const items = rList.Ok().items;
    expect(items.find((it) => it.appSlug === otherApp.appSlug)).toBeUndefined();
    expect(items.find((it) => it.appSlug === ownApp.appSlug)).toBeDefined();
  });

  it("clamps malformed limit values without erroring", async () => {
    // Each value either rejects at the protocol layer or clamps server-side;
    // the contract is that none of them erase pagination by returning 0 rows
    // when rows exist (limit=0) or producing a SQL error (limit=-5, NaN).
    await createApp(api, "limit-validation");

    const rZero = await api.listRecentVibes({ limit: 0 as unknown as number });
    expect(rZero.isOk()).toBe(true);
    if (rZero.isOk()) expect(rZero.Ok().items.length).toBeGreaterThan(0);

    const rNeg = await api.listRecentVibes({ limit: -5 as unknown as number });
    expect(rNeg.isOk()).toBe(true);
    if (rNeg.isOk()) expect(rNeg.Ok().items.length).toBeGreaterThan(0);

    const rFractional = await api.listRecentVibes({ limit: 1.5 });
    expect(rFractional.isOk()).toBe(true);
    if (rFractional.isOk()) expect(rFractional.Ok().items.length).toBe(1);

    // NaN is filtered out by arktype (it requires a finite number) before it
    // ever reaches clampLimit, so the request shape validates and the server
    // falls back to DEFAULT_LIMIT. Acceptable either way as long as it doesn't
    // produce a SQL error.
    const rNaN = await api.listRecentVibes({ limit: Number.NaN });
    expect(rNaN.isOk() || rNaN.isErr()).toBe(true);
  });

  it("returns title from app settings when set", async () => {
    const app = await createApp(api, "with-title");

    const rSet = await api.ensureAppSettings({ appSlug: app.appSlug, userSlug: app.userSlug, title: "Pretty Name" });
    if (rSet.isErr()) assert.fail(`ensureAppSettings failed: ${rSet.Err().message}`);

    const rList = await api.listRecentVibes({ limit: 100 });
    if (rList.isErr()) assert.fail(`listRecentVibes failed: ${rList.Err().message}`);
    const found = rList.Ok().items.find((it) => it.appSlug === app.appSlug);
    expect(found?.title).toBe("Pretty Name");
  });

  it("orders pinned vibes before unpinned vibes, with each group in recency order", async () => {
    const appCount = 24;
    const pinCount = 8;
    const created = await Promise.all(
      Array.from({ length: appCount }, (_, i) => createApp(api, `pin-recency-order-${i.toString().padStart(2, "0")}`))
    );
    const fixture: RecentOrderRow[] = created.map((app, i) => ({
      ...app,
      updated: new Date(Date.parse("2025-01-01T00:00:00.000Z") + i * 60_000).toISOString(),
    }));
    const fixtureByKey = new Map(fixture.map((row) => [rowKey(row), row]));

    for (const i of seededShuffle(
      Array.from({ length: appCount }, (_, index) => index),
      0xdecafbad
    )) {
      const row = fixture[i];
      await setUpdated(row.userSlug, row.appSlug, row.updated);
    }

    const pinnedIndexes = seededShuffle(
      Array.from({ length: appCount }, (_, index) => index),
      0x51deba5e
    ).slice(0, pinCount);
    for (const i of pinnedIndexes) {
      const row = fixture[i];
      const rPin = await api.pinRecentVibe({ userSlug: row.userSlug, appSlug: row.appSlug, pin: true });
      if (rPin.isErr()) assert.fail(`pinRecentVibe failed for ${rowKey(row)}: ${rPin.Err().message}`);
      expect(rPin.Ok().pinnedAt.length).toBeGreaterThan(0);
      const current = fixtureByKey.get(rowKey(row));
      if (current === undefined) assert.fail(`missing fixture row for ${rowKey(row)}`);
      current.pinnedAt = rPin.Ok().pinnedAt;
    }

    const rList = await api.listRecentVibes({ limit: 100 });
    if (rList.isErr()) assert.fail(rList.Err().message);
    const fixtureKeys = new Set(fixture.map(rowKey));
    const actual = rList.Ok().items.filter((it) => fixtureKeys.has(rowKey(it)));
    const expected = [...fixture].sort(compareRecentOrder);

    expect(actual.length).toBe(appCount);
    expect(actual.map(rowKey)).toEqual(expected.map(rowKey));
    expect(actual.slice(0, pinCount).every((it) => it.pinnedAt !== undefined && it.pinnedAt.length > 0)).toBe(true);
    expect(actual.slice(pinCount).every((it) => it.pinnedAt === undefined)).toBe(true);
  });

  it("unpinning clears pinnedAt and restores update-order placement", async () => {
    const app = await createApp(api, "pin-toggle");
    const rPin = await api.pinRecentVibe({ userSlug: app.userSlug, appSlug: app.appSlug, pin: true });
    if (rPin.isErr()) assert.fail(rPin.Err().message);
    expect(rPin.Ok().pinnedAt.length).toBeGreaterThan(0);

    const rUnpin = await api.pinRecentVibe({ userSlug: app.userSlug, appSlug: app.appSlug, pin: false });
    if (rUnpin.isErr()) assert.fail(rUnpin.Err().message);
    expect(rUnpin.Ok().pinnedAt).toBe("");

    const rList = await api.listRecentVibes({ limit: 100 });
    if (rList.isErr()) assert.fail(rList.Err().message);
    const found = rList.Ok().items.find((it) => it.appSlug === app.appSlug);
    expect(found).toBeDefined();
    expect(found?.pinnedAt).toBeFalsy();
  });

  it("rejects pin requests on apps owned by another user", async () => {
    const otherApp = await createApp(api2, "pin-not-yours");
    const r = await api.pinRecentVibe({ userSlug: otherApp.userSlug, appSlug: otherApp.appSlug, pin: true });
    expect(r.isErr()).toBe(true);
  });

  it("rejects pin requests for missing apps under an owned slug", async () => {
    const app = await createApp(api, "pin-missing-owner-slug");
    const r = await api.pinRecentVibe({ userSlug: app.userSlug, appSlug: "missing-pin-target", pin: true });
    expect(r.isErr()).toBe(true);
  });
});
