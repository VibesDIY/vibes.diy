# Channel-scoped `evt-doc-changed` dbName decouple — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make live doc updates (edits and deletes) reach other connected clients on access-fn vibes by decoupling the fan-out routing key (channel) from the event payload's `dbName` (real db), so the client's `data.dbName === this.name` filter passes again.

**Architecture:** The server fans out `evt-doc-changed` by channel for access-fn vibes but overloads the payload `dbName` with the channel name; the client drops events whose `dbName` isn't the real db. Fix: `notifyDocChanged` routes by `channel ?? dbName` but emits the payload with the real `dbName` plus an optional `channel`. Channels are normalized (trim/drop-empty/dedupe) by a shared helper used in both the subscribe-key path and the notify fan-out so keys stay in sync. The delete path gains best-effort per-channel fan-out sourced from the stored `accessFnOutputs` row.

**Tech Stack:** TypeScript, arktype runtime types, Drizzle ORM (SQLite + Postgres schemas), Vitest, `@adviser/cement` Evento/WS test harness.

**Spec:** [docs/superpowers/specs/2026-06-09-channel-doc-changed-dbname-design.md](../specs/2026-06-09-channel-doc-changed-dbname-design.md)

**Working dir:** all paths are relative to repo root. Run tests from `vibes.diy/api` (or the repo with the api package filter). Commit after every task.

---

### Task 1: `normalizeChannels` shared helper

**Files:**

- Create: `vibes.diy/api/svc/public/normalize-channels.ts`
- Test: `vibes.diy/api/tests/normalize-channels.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/normalize-channels.test.ts
import { describe, expect, it } from "vitest";
import { normalizeChannels } from "@vibes.diy/api-svc";

describe("normalizeChannels", () => {
  it("trims whitespace", () => {
    expect(normalizeChannels([" a ", "b\t"])).toEqual(["a", "b"]);
  });
  it("drops empty and whitespace-only entries", () => {
    expect(normalizeChannels(["", "   ", "x"])).toEqual(["x"]);
  });
  it("dedupes after trimming", () => {
    expect(normalizeChannels(["a", " a", "a "])).toEqual(["a"]);
  });
  it("returns [] for all-empty input", () => {
    expect(normalizeChannels(["", "  "])).toEqual([]);
  });
  it("returns [] for empty input", () => {
    expect(normalizeChannels([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run tests/normalize-channels.test.ts`
Expected: FAIL — `normalizeChannels` is not exported.

- [ ] **Step 3: Write the helper**

```ts
// vibes.diy/api/svc/public/normalize-channels.ts

// Channels come from the access fn as an unconstrained string[]. An empty or
// whitespace-only channel would build a broken routing key (ownerHandle/appSlug/)
// and — because `channel ?? dbName` only falls through on null/undefined, NOT ""
// — would NOT fall back to the real dbName. Normalize before both subscribe-key
// construction and notify fan-out so subscriber keys and notify keys stay in sync.
export function normalizeChannels(channels: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const c of channels) {
    const t = c.trim();
    if (t.length > 0) seen.add(t);
  }
  return [...seen];
}
```

- [ ] **Step 4: Export from the api-svc package barrel**

Add to `vibes.diy/api/svc/index.ts` (alongside the other `public/*` re-exports — match the existing export style in that file):

```ts
export * from "./public/normalize-channels.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd vibes.diy/api && pnpm vitest run tests/normalize-channels.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/public/normalize-channels.ts vibes.diy/api/svc/index.ts vibes.diy/api/tests/normalize-channels.test.ts
git commit -m "feat(api): add normalizeChannels helper (#2301)"
```

Note: if `@vibes.diy/api-svc` doesn't resolve in the test, import directly from the relative source path the other tests in `vibes.diy/api/tests/` use for svc internals — check a sibling test's import for `WSSendProvider`/`vibesMsgEvento` (they import from `@vibes.diy/api-svc`). Use the same specifier.

---

### Task 2: Add optional `channel` to `evtDocChanged` type + `notifyDocChanged` signatures

**Files:**

- Modify: `vibes.diy/api/types/app-documents.ts:196-209` (evtDocChanged)
- Modify: `vibes.diy/api/svc/types.ts:58-61` (notifyDocChanged interface)
- Modify: `vibes.diy/api/svc/create-handler.ts:51-54` (notifyDocChanged interface)

- [ ] **Step 1: Add `channel?` to the arktype `evtDocChanged`**

In `vibes.diy/api/types/app-documents.ts`, update the type (keep the existing `dbName` comment):

```ts
export const evtDocChanged = type({
  type: "'vibes.diy.evt-doc-changed'",
  ownerHandle: "string",
  appSlug: "string",
  // dbName carries the per-db ACL boundary out to subscribers — without it,
  // a connection that subscribed to one readable db could observe change
  // notifications from another db whose `read` ACL is tighter.
  dbName: "string",
  docId: "string",
  // channel: for access-fn vibes, the fan-out routing channel. Informational to
  // the client (it filters on dbName); present only when channel-scoped fan-out
  // is used. See #2301.
  "channel?": "string",
});
```

- [ ] **Step 2: Widen the two `notifyDocChanged` interface declarations**

In `vibes.diy/api/svc/types.ts` (line ~58) and `vibes.diy/api/svc/create-handler.ts` (line ~51), change the `evt` arg type in BOTH to add `channel?`:

```ts
notifyDocChanged?(
  evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string },
  senderConnId: string
): Promise<void>;
```

- [ ] **Step 3: Typecheck**

Run: `cd vibes.diy/api && pnpm tsc --noEmit`
Expected: PASS (no type errors; existing callers still satisfy the wider type since `channel` is optional).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/types/app-documents.ts vibes.diy/api/svc/types.ts vibes.diy/api/svc/create-handler.ts
git commit -m "feat(api): optional channel field on evtDocChanged + notifyDocChanged (#2301)"
```

---

### Task 3: Route by `channel ?? dbName` in `localBroadcastCallbacks`

**Files:**

- Modify: `vibes.diy/api/svc/cf-serve.ts:91-114`
- Test: `vibes.diy/api/tests/local-broadcast-doc-changed.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// vibes.diy/api/tests/local-broadcast-doc-changed.test.ts
import { describe, expect, it } from "vitest";
import { TestWSPair } from "@adviser/cement";
import { localBroadcastCallbacks, WSSendProvider } from "@vibes.diy/api-svc";

// Minimal CFEnv stand-in: only ENVIRONMENT is read (for shouldLog).
const env = { ENVIRONMENT: "test" } as never;

function decodePayload(provider: WSSendProvider, raw: ArrayBuffer | Uint8Array | string): unknown {
  const obj = provider.ende.asObj(raw) as { payload?: unknown };
  return obj.payload;
}

describe("localBroadcastCallbacks.notifyDocChanged routing decouple (#2301)", () => {
  it("routes by channel but delivers payload with the real dbName", async () => {
    const pair = TestWSPair.create();
    const receiver = new WSSendProvider(pair.p2 as unknown as WebSocket);
    // Subscriber registered the CHANNEL key (access-fn vibe behavior).
    receiver.subscribedDocKeys.add("alice/app1/doc-channel-1");

    const connections = new Set<WSSendProvider>([receiver]);
    const cb = localBroadcastCallbacks(connections, env);

    const got: unknown[] = [];
    pair.p1.onmessage = (e: MessageEvent) => got.push(decodePayload(receiver, e.data));

    await cb.notifyDocChanged(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", channel: "doc-channel-1" },
      "sender-conn-id"
    );

    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({
      type: "vibes.diy.evt-doc-changed",
      ownerHandle: "alice",
      appSlug: "app1",
      dbName: "default", // REAL db — client filter would pass
      docId: "d1",
      channel: "doc-channel-1",
    });
  });

  it("excludes the originating connection", async () => {
    const pair = TestWSPair.create();
    const sender = new WSSendProvider(pair.p2 as unknown as WebSocket);
    sender.subscribedDocKeys.add("alice/app1/doc-channel-1");
    const connections = new Set<WSSendProvider>([sender]);
    const cb = localBroadcastCallbacks(connections, env);

    const got: unknown[] = [];
    pair.p1.onmessage = (e: MessageEvent) => got.push(e.data);

    await cb.notifyDocChanged(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", channel: "doc-channel-1" },
      sender.connId // same connId => excluded
    );
    expect(got).toHaveLength(0);
  });

  it("falls back to dbName routing when no channel is given", async () => {
    const pair = TestWSPair.create();
    const receiver = new WSSendProvider(pair.p2 as unknown as WebSocket);
    receiver.subscribedDocKeys.add("alice/app1/default"); // subscribed by real dbName
    const connections = new Set<WSSendProvider>([receiver]);
    const cb = localBroadcastCallbacks(connections, env);

    const got: unknown[] = [];
    pair.p1.onmessage = (e: MessageEvent) => got.push(decodePayload(receiver, e.data));

    await cb.notifyDocChanged({ ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1" }, "sender");
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ dbName: "default", docId: "d1" });
    expect((got[0] as { channel?: string }).channel).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run tests/local-broadcast-doc-changed.test.ts`
Expected: FAIL on the first test — current code computes `key` from `evt.dbName`, so a subscriber on the channel key `alice/app1/doc-channel-1` is NOT matched when `evt.dbName === "default"` → `got` is empty.

(If `provider.ende.asObj` isn't the exact decode method, check `JSONEnDecoder` in `@adviser/cement` for the decode counterpart of `uint8ify` and use it; the encoder used in cf-serve is `conn.ende.uint8ify`.)

- [ ] **Step 3: Implement the routing decouple**

In `vibes.diy/api/svc/cf-serve.ts`, change the `notifyDocChanged` body in `localBroadcastCallbacks` so the routing key uses the channel when present, while the payload is emitted verbatim (carrying the real `dbName` + optional `channel`):

```ts
notifyDocChanged: async (
  evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string },
  senderConnId: string
): Promise<void> => {
  // Route by channel for access-fn vibes; fall back to dbName otherwise. The
  // payload keeps the REAL dbName so the client's `data.dbName === this.name`
  // filter passes (see #2301). channel `??` only falls through on null/undefined;
  // callers normalize channels so "" never reaches here.
  const routingKey = evt.channel ?? evt.dbName;
  const key = `${evt.ownerHandle}/${evt.appSlug}/${routingKey}`;
  if (shouldLog) {
    console.info("[AppSessions] notifyDocChanged key:", key, "conn:", senderConnId.slice(0, 8));
  }
  const fullEvt = { type: "vibes.diy.evt-doc-changed", ...evt };
  for (const conn of connections) {
    if (!conn.subscribedDocKeys.has(key)) continue;
    if (conn.connId === senderConnId) continue;
    exception2Result(() =>
      conn.ws.send(
        conn.ende.uint8ify({
          tid: crypto.randomUUID(),
          src: "vibes.diy.api",
          dst: "vibes.diy.client",
          ttl: 10,
          payload: fullEvt,
        })
      )
    );
  }
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy/api && pnpm vitest run tests/local-broadcast-doc-changed.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/cf-serve.ts vibes.diy/api/tests/local-broadcast-doc-changed.test.ts
git commit -m "fix(api): route doc-changed by channel, deliver real dbName (#2301)"
```

---

### Task 4: Subscribe handler — normalize channels before building keys

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-read-eventos.ts:457-505`

- [ ] **Step 1: Import the helper**

At the top of `app-documents-read-eventos.ts`, add (match the existing relative import style for `./grant-reduce.js` etc.):

```ts
import { normalizeChannels } from "./normalize-channels.js";
```

- [ ] **Step 2: Normalize channels at the point keys are built**

The handler collects channels into `channelKeys` for both the `override` branch (`allChannels` set) and the grant branch (`effectiveChannels` + `publicChannels`). Replace the raw channel iteration so each source list is normalized before `channelKeys.push`. Concretely, build a single `string[]` of raw channels per branch, then:

```ts
// override branch — after building `allChannels: Set<string>`:
for (const ch of normalizeChannels([...allChannels])) {
  channelKeys.push(`${req.ownerHandle}/${req.appSlug}/${ch}`);
}
```

```ts
// grant branch — replace the two separate push loops:
const rawGrantChannels = [...effectiveChannels, ...reduce.publicChannels];
for (const ch of normalizeChannels(rawGrantChannels)) {
  channelKeys.push(`${req.ownerHandle}/${req.appSlug}/${ch}`);
}
```

This keeps subscriber keys identical to the (also-normalized) notify keys, so a channel like `" x"` can't desync.

- [ ] **Step 3: Typecheck + run the existing subscribe test**

Run: `cd vibes.diy/api && pnpm tsc --noEmit && pnpm vitest run tests/app-documents-subscribe.test.ts`
Expected: PASS — existing subscribe behavior unchanged for normal (already-clean) channels.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-read-eventos.ts
git commit -m "fix(api): normalize channels when building subscribe keys (#2301)"
```

---

### Task 5: Write path — pass real `dbName` + normalized channel

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts:460-475`
- Modify: `vibes.diy/api/tests/vibe-diy-test-ctx.ts:50-58,178-189` (add `notifyDocChanged` opt)
- Test: `vibes.diy/api/tests/doc-changed-channel-fanout.test.ts`

- [ ] **Step 1: Add a recording `notifyDocChanged` to the test ctx opts**

In `vibes.diy/api/tests/vibe-diy-test-ctx.ts`, add to `CreateVibeDiyTestCtxOpts` (next to `notifyViewerGrantsChanged`):

```ts
notifyDocChanged?(
  evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string },
  senderConnId: string
): Promise<void>;
```

and wire it in the ctx object (next to `notifyViewerGrantsChanged: opts.notifyViewerGrantsChanged,`):

```ts
notifyDocChanged: opts.notifyDocChanged,
```

- [ ] **Step 2: Write the failing test (write path)**

```ts
// vibes.diy/api/tests/doc-changed-channel-fanout.test.ts
import { assert, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const ACCESS_JS = `export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  return { channels: [doc._id], allowAnonymous: true };
}`;

interface NotifyRec {
  evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; channel?: string };
  senderConnId: string;
}

describe("doc-changed channel fan-out carries real dbName (#2301)", { timeout: 30000 }, () => {
  let ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let ownerHandle: string;
  let appSlug: string;
  const notifies: NotifyRec[] = [];
  const access = { result: { channels: ["x"], allowAnonymous: true } as unknown };

  beforeAll(async () => {
    const sthis = ensureSuperThis();
    const deviceCA = await createTestDeviceCA(sthis);
    ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
      invokeAccessFn: async () => access.result as never,
      notifyDocChanged: async (evt, senderConnId) => {
        notifies.push({ evt, senderConnId });
      },
    });
    const wsPair = TestWSPair.create();
    const wsEvento = vibesMsgEvento();
    const wsSend = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
    ctx.vibesCtx.connections.add(wsSend);
    wsPair.p2.onmessage = (event: MessageEvent) =>
      wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSend });

    const user = await createTestUser({ sthis, deviceCA, seqUserId: 900 });
    ownerApi = new VibesDiyApi({
      apiUrl: "http://localhost:8787/api",
      ws: wsPair.p1 as unknown as WebSocket,
      timeoutMs: 10000,
      getToken: async () => Result.Ok(await user.getDashBoardToken()),
    });
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App(){return null} App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("app create failed");
    ownerHandle = res.ownerHandle;
    appSlug = res.appSlug;
  }, 30000);

  it("edit on an access-fn vibe notifies per channel with the real dbName", async () => {
    notifies.length = 0;
    access.result = { channels: ["chan-A", "chan-B"], allowAnonymous: true };
    const res = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "default", doc: { _id: "d1", n: 1 } });
    expect(res.Ok().status).toBe("ok");
    // One notify per channel, each carrying dbName: "default" (real db), not the channel.
    expect(notifies.map((n) => n.evt.channel).sort()).toEqual(["chan-A", "chan-B"]);
    for (const n of notifies) {
      expect(n.evt.dbName).toBe("default");
      expect(n.evt.docId).toBe("d1");
    }
  });

  it("all-empty channels fall back to a single dbName notify", async () => {
    notifies.length = 0;
    access.result = { channels: ["", "   "], allowAnonymous: true };
    const res = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "default", doc: { _id: "d2", n: 2 } });
    expect(res.Ok().status).toBe("ok");
    expect(notifies).toHaveLength(1);
    expect(notifies[0].evt.dbName).toBe("default");
    expect(notifies[0].evt.channel).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd vibes.diy/api && pnpm vitest run tests/doc-changed-channel-fanout.test.ts`
Expected: FAIL on test 1 — current code calls `notifyDocChanged({ ..., dbName: channel, docId })`, so `n.evt.dbName` is `"chan-A"`/`"chan-B"` and `n.evt.channel` is `undefined`. Test 2 also fails — empty channels currently produce two notifies with `dbName: ""`.

- [ ] **Step 4: Implement the write-path change**

In `vibes.diy/api/svc/public/app-documents-write-eventos.ts`, add the import near the other `./` imports:

```ts
import { normalizeChannels } from "./normalize-channels.js";
```

Replace the notify block (currently ~460-474):

```ts
if (vctx.notifyDocChanged) {
  const channels = normalizeChannels(accessResult?.channels ?? []);
  if (channels.length) {
    for (const channel of channels) {
      vctx
        .notifyDocChanged({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId, channel }, clientWsSend(ctx).connId)
        .catch((e: unknown) => console.error("DocNotify channel error:", e));
    }
  } else {
    vctx
      .notifyDocChanged({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId }, clientWsSend(ctx).connId)
      .catch((e: unknown) => console.error("DocNotify error:", e));
  }
}
```

(`dbName` here is the real db var already in scope in this handler.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd vibes.diy/api && pnpm vitest run tests/doc-changed-channel-fanout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/tests/vibe-diy-test-ctx.ts vibes.diy/api/tests/doc-changed-channel-fanout.test.ts
git commit -m "fix(api): write path emits real dbName + channel for doc-changed (#2301)"
```

---

### Task 6: Delete path — best-effort per-channel fan-out

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts:616-625` (deleteDoc notify block)
- Test: extend `vibes.diy/api/tests/doc-changed-channel-fanout.test.ts`

- [ ] **Step 1: Add failing delete tests**

Append to `doc-changed-channel-fanout.test.ts` inside the same `describe`:

```ts
it("delete on an access-fn vibe fans out per stored channel with real dbName", async () => {
  // Seed: write d3 so its accessFnOutputs row stores channels.
  access.result = { channels: ["del-chan"], allowAnonymous: true };
  await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "default", doc: { _id: "d3", n: 3 } });

  notifies.length = 0;
  const res = await ownerApi.deleteDoc({ ownerHandle, appSlug, dbName: "default", docId: "d3" });
  expect(res.Ok().status).toBe("ok");
  expect(notifies).toHaveLength(1);
  expect(notifies[0].evt.dbName).toBe("default");
  expect(notifies[0].evt.channel).toBe("del-chan");
  expect(notifies[0].evt.docId).toBe("d3");
});

it("delete with no stored output row falls back to a single dbName notify", async () => {
  // d4 was never written, so no accessFnOutputs row exists.
  notifies.length = 0;
  const res = await ownerApi.deleteDoc({ ownerHandle, appSlug, dbName: "default", docId: "d4-never-written" });
  expect(res.Ok().status).toBe("ok");
  expect(notifies).toHaveLength(1);
  expect(notifies[0].evt.dbName).toBe("default");
  expect(notifies[0].evt.channel).toBeUndefined();
});
```

(Confirm the client API method name is `deleteDoc` with arg shape `{ ownerHandle, appSlug, dbName, docId }` — see how `reqDeleteDoc` is built in `VibesDiyApi`; adjust the call to match.)

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd vibes.diy/api && pnpm vitest run tests/doc-changed-channel-fanout.test.ts`
Expected: FAIL — delete currently notifies once with `dbName: "default"` and no `channel`, so the first delete test (expects `channel: "del-chan"`) fails. The fallback test already passes by coincidence; that's fine.

- [ ] **Step 3: Implement delete-path channel fan-out**

In `app-documents-write-eventos.ts`, the deleteDoc handler already has `vctx`, `req`, `dbName`, and `clientWsSend(ctx)` in scope, and imports `and`, `eq`, `sql` from drizzle and `inArray` (used by the write/subscribe AFB lookups). Replace the delete notify block (currently ~616-625):

```ts
// Notify DocNotify coordinator for cross-shard fan-out. On access-fn vibes,
// fan out per stored channel so channel-subscribed connections receive the
// delete. Best-effort: if there's no binding or stored output row, fall back
// to a single real-dbName notify (correct for no-access-fn vibes). Never block
// the delete on this lookup.
if (vctx.notifyDocChanged) {
  const senderConnId = clientWsSend(ctx).connId;
  let channels: string[] = [];
  try {
    const tAfb = vctx.sql.tables.accessFunctionBindings;
    const afbRow = await vctx.sql.db
      .select({ accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), inArray(tAfb.dbName, [dbName, "*"])))
      .orderBy(sql`CASE WHEN ${tAfb.dbName} = ${dbName} THEN 0 ELSE 1 END`)
      .limit(1)
      .then((r) => r[0]);
    if (afbRow?.accessFnCid) {
      const tOut = vctx.sql.tables.accessFnOutputs;
      const outRow = await vctx.sql.db
        .select({ output: tOut.output })
        .from(tOut)
        .where(
          and(
            eq(tOut.ownerHandle, req.ownerHandle),
            eq(tOut.appSlug, req.appSlug),
            eq(tOut.dbName, dbName),
            eq(tOut.docId, req.docId)
          )
        )
        .limit(1)
        .then((r) => r[0]);
      if (outRow?.output) {
        const parsed = JSON.parse(outRow.output) as { channels?: string[] };
        channels = normalizeChannels(parsed.channels ?? []);
      }
    }
  } catch (e: unknown) {
    console.error("DocNotify delete channel lookup error:", e);
  }

  if (channels.length) {
    for (const channel of channels) {
      vctx
        .notifyDocChanged({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId: req.docId, channel }, senderConnId)
        .catch((e: unknown) => console.error("DocNotify channel error:", e));
    }
  } else {
    vctx
      .notifyDocChanged({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId: req.docId }, senderConnId)
      .catch((e: unknown) => console.error("DocNotify error:", e));
  }
}
```

If `inArray` / `sql` aren't already imported in this file, add them to the existing `drizzle-orm` import. (The write/subscribe paths use the same pattern — copy their import line.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd vibes.diy/api && pnpm vitest run tests/doc-changed-channel-fanout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/tests/doc-changed-channel-fanout.test.ts
git commit -m "fix(api): delete path fans out per stored channel with real dbName (#2301)"
```

---

### Task 7: Client filter — confirm-only test (no code change)

**Files:**

- Reference (no change): `vibes.diy/vibe/runtime/firefly-database.ts:138-148`

The client filter `data.dbName === this.name` is now correct because the payload carries the real `dbName`. No code change. Confirm there is no client-side assumption that `dbName` is a channel.

- [ ] **Step 1: Grep for any client consumer of the (now-present) `channel` field**

Run: `grep -rn "\.channel" vibes.diy/vibe/runtime/ vibes.diy/use-vibes 2>/dev/null | grep -i "docchanged\|evt-doc\|data\.channel"`
Expected: no consumers depend on `dbName` being a channel; `channel` is unused client-side (informational only). If a consumer exists that read `dbName` as a channel, stop and surface it — the spec assumes none.

- [ ] **Step 2: No commit (verification only).**

---

### Task 8: Full verification

- [ ] **Step 1: Run the full check**

Run from repo root: `pnpm check 2>&1 | tee /tmp/check-2301.log | tail -40`
Expected: format + build + test + lint all green. If a known-flaky test fails, rerun the affected suite in isolation before treating it as real (see agents/flaky-tests.md).

- [ ] **Step 2: Prettier the changed files (belt-and-suspenders)**

Run: `npx prettier --write $(git diff --name-only main...HEAD | grep -E '\.(ts|md)$')`
Then re-stage/commit only if prettier changed anything:

```bash
git add -A && git commit -m "style: prettier (#2301)" || echo "nothing to format"
```

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Update PR #2302 body**

The PR currently says "spec only". Edit it to note the implementation has landed, listing the commits and the test files, and link the plan.

---

## Self-Review notes

- **Spec coverage:** §0 normalizeChannels → Task 1 + Task 4 (subscribe) + Task 5/6 (notify). §1 type → Task 2. §2 notifyDocChanged routing → Task 2 (sig) + Task 3 (impl). §3 write path → Task 5. §4 delete path → Task 6. Testing §: empty-channel (Task 5 test 2), delete-absent-row (Task 6 test 2), normalizeChannels unit (Task 1), routing/sender-exclusion (Task 3). Client filter (no change) → Task 7.
- **Cross-shard coordinator:** `grep notifyDocChanged` shows only `localBroadcastCallbacks` implements it today; no separate cross-shard impl to update. Task 3 is the only routing impl. If a second impl appears, apply the same `channel ?? dbName` there.
- **Type consistency:** `channel?: string` is identical across `evtDocChanged`, both `notifyDocChanged` interface decls, the cf-serve impl arg, the test ctx opt, and the `NotifyRec` test type.
