# Live merge presence-broadcast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `useDocument().merge()` also emit-only broadcast the merged doc snapshot to peers on the same db/channel, surfaced as an in-memory overlay through the existing hooks — presence (cursors/typing/selection) with no `merge()` API change and no persistence.

**Architecture:** A new emit-only wire event `evt-doc-ephemeral` carries the merged doc snapshot; the client sends it fire-and-forget via a new `req-broadcast-ephemeral`. The server relays it to other connections **routed by the sender connection's own channel subscription keys** (no persistence, no access-fn eval, exact-channel — never the bare-db fallback), with a payload-size cap, per-connection rate circuit-breaker, and in/out/drop counters. `FireflyDatabase` folds received snapshots into an in-memory overlay (keyed by `_id`, `originPeer` retained for cleanup) applied inside `get`/`query`/`allDocs`, dropped on `evt-doc-ephemeral-drop` (connection close) and by a receiver TTL backstop. `merge()` gains one branch that coalesces per-`_id` to one send per animation frame.

**Tech Stack:** TypeScript, arktype (`type({...})` wire schemas), Evento websocket handlers, Cloudflare Durable Object (`Sessions`), React hooks, vitest (`api-tests` + `app` projects).

**Spec:** `docs/superpowers/specs/2026-06-30-live-merge-presence-broadcast-design.md` (PR #2968).

---

## Design decisions locked before coding

These resolve gaps the spec left to implementation. Read them before Task 1.

1. **Routing without persistence.** An ephemeral is not persisted, so there is no access-fn output to compute channels from. The server routes an ephemeral by the **sender connection's own `subscribedDocKeys` that fall under this db** (`key === dbKey || key.startsWith(dbKey + "/")`). A peer can only hold channel keys it was granted at subscribe time, so it can never route presence beyond its own granted channels. Non-access-fn vibes: the sender holds the bare `dbKey`, so delivery is db-wide (correct — no channel boundary exists). The one residual over-delivery (an access-fn sender that holds _only_ the bare `dbKey` in the join-before-grant window) is caught by the **receiver-side channel check** (Task 7, Step "defense-in-depth gate").
2. **No new subscription message.** Receiving ephemerals reuses the existing `subscribeDocs` registration (`subscribedDocKeys`). `useDocument`/`useLiveQuery` already call `subscribeDocs`, so no client subscribe change is needed — only a send path and a receive/overlay path.
3. **Fire-and-forget, no response.** `req-broadcast-ephemeral` has no `res-*` type. The server handler processes it and returns `Continue` without sending a reply; the client never awaits. This keeps 60Hz traffic off the request/response correlation machinery.
4. **`evt-doc-ephemeral-drop` carries only `originPeer`.** All connections in a per-vibe `Sessions` DO belong to the same vibe, and the overlay is keyed by `_id` with `originPeer` recorded per slice, so the drop only needs the departing `connId`. (This simplifies the spec's drop shape; reconcile the spec's `evtDocEphemeralDrop` to drop `ownerHandle`/`appSlug`/`dbName` in Task 1.)
5. **Snapshot, not partial.** The wire field is `doc` = the merged client doc snapshot (`{ ...doc, ...partial }`), so receiver-synthesized `useLiveQuery` rows carry `type`/indexed fields.

---

## File map

**Create:**

- `vibes.diy/api/tests/local-broadcast-ephemeral.test.ts` — server fan-out unit tests
- `vibes.diy/api/tests/broadcast-ephemeral-handler.test.ts` — inbound evento handler test
- `vibes.diy/vibe/runtime/firefly-ephemeral-overlay.test.ts` (or under `tests/app/`) — receiver overlay unit tests
- `vibes.diy/vibe/runtime/merge-coalescer.ts` — sender per-`_id` animation-frame coalescer (pure, testable)

**Modify:**

- `vibes.diy/api/types/app-documents.ts` — `reqBroadcastEphemeral`, `evtDocEphemeral`, `evtDocEphemeralDrop` + guards
- `vibes.diy/api/svc/types.ts` — `VibesApiSQLCtx.notifyDocEphemeral?` / `notifyDocEphemeralDrop?`
- `vibes.diy/api/svc/create-handler.ts` — same decls + wire-through (~L326)
- `vibes.diy/api/svc/cf-serve.ts` — `notifyDocEphemeral` + `notifyDocEphemeralDrop` in `localBroadcastCallbacks`; close/error hook emits drop
- `vibes.diy/api/svc/public/app-documents-write-eventos.ts` — new `broadcastEphemeralEvento`
- `vibes.diy/api/svc/evento-handler-manifest.ts` — register the handler
- `vibes.diy/api/impl/index.ts` — `VibesDiyApi.broadcastEphemeral` (fire-and-forget) + `onDocEphemeral` / `onDocEphemeralDrop` listeners
- `vibes.diy/api/impl/firefly-api-adapter.ts` — `broadcastEphemeral` + bridge ephemeral events into `onMsg`
- `vibes.diy/vibe/runtime/register-dependencies.ts` — `VibeSandboxApi.broadcastEphemeral` (postMessage, fire-and-forget)
- `vibes.diy/vibe/runtime/firefly-database.ts` — `FireflyTransport.broadcastEphemeral`; overlay state + fold + TTL + drop
- `vibes.diy/vibe/runtime/use-firefly.ts` — `merge()` broadcast branch + coalescer
- `notes/vibes-app-jsx.md` (or the app-facing recipe doc) — presence recipe + private-draft note
- `docs/superpowers/specs/2026-06-30-live-merge-presence-broadcast-design.md` — reconcile drop shape + routing decision

---

## Task 1: Wire types (`evt-doc-ephemeral`, `evt-doc-ephemeral-drop`, `req-broadcast-ephemeral`)

**Files:**

- Modify: `vibes.diy/api/types/app-documents.ts` (add after `evtDocChanged`, ~L213)

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/api/tests/ephemeral-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  reqBroadcastEphemeral,
  isReqBroadcastEphemeral,
  evtDocEphemeral,
  isEvtDocEphemeral,
  evtDocEphemeralDrop,
  isEvtDocEphemeralDrop,
} from "@vibes.diy/api-types";
import { type } from "arktype";

describe("ephemeral wire types", () => {
  it("reqBroadcastEphemeral validates a well-formed request", () => {
    const ok = {
      type: "vibes.diy.req-broadcast-ephemeral",
      ownerHandle: "alice",
      appSlug: "app1",
      dbName: "default",
      docId: "cursor-alice",
      doc: { _id: "cursor-alice", type: "cursor", curX: 1, curY: 2 },
    };
    expect(reqBroadcastEphemeral(ok) instanceof type.errors).toBe(false);
    expect(isReqBroadcastEphemeral(ok)).toBe(true);
    expect(isReqBroadcastEphemeral({ type: "vibes.diy.req-broadcast-ephemeral" })).toBe(false);
  });

  it("evtDocEphemeral validates and carries originPeer + doc", () => {
    const ok = {
      type: "vibes.diy.evt-doc-ephemeral",
      ownerHandle: "alice",
      appSlug: "app1",
      dbName: "default",
      docId: "cursor-alice",
      originPeer: "conn-1",
      doc: { _id: "cursor-alice", type: "cursor", curX: 1 },
      channel: "notes",
    };
    expect(isEvtDocEphemeral(ok)).toBe(true);
    // channel is optional
    const noChannel = { ...ok, channel: undefined };
    expect(isEvtDocEphemeral(noChannel)).toBe(true);
  });

  it("evtDocEphemeralDrop validates with only originPeer", () => {
    const ok = { type: "vibes.diy.evt-doc-ephemeral-drop", originPeer: "conn-1" };
    expect(isEvtDocEphemeralDrop(ok)).toBe(true);
    expect(isEvtDocEphemeralDrop({ type: "vibes.diy.evt-doc-ephemeral-drop" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/vibes.diy && npx vitest --run --project api-tests ephemeral-types`
Expected: FAIL — `reqBroadcastEphemeral` is not exported.

- [ ] **Step 3: Add the types**

In `vibes.diy/api/types/app-documents.ts`, after the `evtDocChanged` block (after L213), add:

```typescript
// ── ephemeral doc broadcast (live merge, #1756) ─────────────────────
// Emit-only: never persisted. Carries the merged client doc snapshot so
// receivers can synthesize a queryable overlay row. `dbName` is the real db
// (client filter matches on it, per #2301); `channel` is the routing channel.

export const reqBroadcastEphemeral = type({
  type: "'vibes.diy.req-broadcast-ephemeral'",
  "auth?": dashAuthType,
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string",
  docId: "string",
  doc: "Record<string, unknown>",
});
export type ReqBroadcastEphemeral = typeof reqBroadcastEphemeral.infer;
export function isReqBroadcastEphemeral(obj: unknown): obj is ReqBroadcastEphemeral {
  return !(reqBroadcastEphemeral(obj) instanceof type.errors);
}

export const evtDocEphemeral = type({
  type: "'vibes.diy.evt-doc-ephemeral'",
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string",
  docId: "string",
  originPeer: "string", // sender connId — the disconnect-cleanup key
  doc: "Record<string, unknown>", // merged client doc snapshot
  "channel?": "string",
});
export type EvtDocEphemeral = typeof evtDocEphemeral.infer;
export function isEvtDocEphemeral(obj: unknown): obj is EvtDocEphemeral {
  return !(evtDocEphemeral(obj) instanceof type.errors);
}

export const evtDocEphemeralDrop = type({
  type: "'vibes.diy.evt-doc-ephemeral-drop'",
  originPeer: "string",
});
export type EvtDocEphemeralDrop = typeof evtDocEphemeralDrop.infer;
export function isEvtDocEphemeralDrop(obj: unknown): obj is EvtDocEphemeralDrop {
  return !(evtDocEphemeralDrop(obj) instanceof type.errors);
}
```

Confirm these symbols are re-exported from the `@vibes.diy/api-types` barrel (this file is already part of it — verify `app-documents.ts` is exported by `vibes.diy/api/types/index.ts`; if the barrel uses explicit re-exports, add the new names).

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /home/user/vibes.diy && npx vitest --run --project api-tests ephemeral-types`
Expected: PASS (3 tests).

- [ ] **Step 5: Reconcile the spec drop shape**

In `docs/superpowers/specs/2026-06-30-live-merge-presence-broadcast-design.md`, edit the `evtDocEphemeralDrop` block (Piece 1) to `{ type, originPeer }` only, and add a one-line note under Piece 5: "Drop carries only `originPeer`; the per-vibe DO scopes it and slices record their writer." (Prettier: `npx prettier --write` the spec.)

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/types/app-documents.ts vibes.diy/api/tests/ephemeral-types.test.ts docs/superpowers/specs/2026-06-30-live-merge-presence-broadcast-design.md
git commit -m "feat(1756): ephemeral doc-broadcast wire types + guards"
```

---

## Task 2: Server context interface decls

**Files:**

- Modify: `vibes.diy/api/svc/types.ts:66-77` (add after `deregisterDocSubscription`)
- Modify: `vibes.diy/api/svc/create-handler.ts:53-58` (decl) and `:326` (wire-through)

- [ ] **Step 1: Add the interface members**

In `vibes.diy/api/svc/types.ts`, immediately after the `deregisterDocSubscription?` line (L71), add:

```typescript
  notifyDocEphemeral?(
    evt: {
      ownerHandle: string;
      appSlug: string;
      dbName: string;
      docId: string;
      doc: Record<string, unknown>;
    },
    senderConnId: string
  ): Promise<void>;
  notifyDocEphemeralDrop?(originPeer: string): Promise<void>;
```

- [ ] **Step 2: Mirror the decl in `create-handler.ts`**

In `vibes.diy/api/svc/create-handler.ts`, after the `deregisterDocSubscription?` decl (~L58), add the same two members verbatim. Then in the ctx-assembly object (~L326, next to `notifyDocChanged: params.notifyDocChanged,`) add:

```typescript
    notifyDocEphemeral: params.notifyDocEphemeral,
    notifyDocEphemeralDrop: params.notifyDocEphemeralDrop,
```

- [ ] **Step 3: Build to verify types compile**

Run: `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/api-svc build` (or `pnpm fast-check`)
Expected: no new type errors. (Optional members — nothing consumes them yet.)

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/types.ts vibes.diy/api/svc/create-handler.ts
git commit -m "feat(1756): declare notifyDocEphemeral(+Drop) on the svc ctx"
```

---

## Task 3: Server fan-out — `notifyDocEphemeral` + `notifyDocEphemeralDrop`

**Files:**

- Modify: `vibes.diy/api/svc/cf-serve.ts` — inside `localBroadcastCallbacks` (add after `notifyDocChanged`, ~L153)
- Test: `vibes.diy/api/tests/local-broadcast-ephemeral.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Model it on `vibes.diy/api/tests/local-broadcast-doc-changed.test.ts`. Create `vibes.diy/api/tests/local-broadcast-ephemeral.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { TestWSPair } from "@adviser/cement";
import { localBroadcastCallbacks, WSSendProvider } from "@vibes.diy/api-svc";
import { JSONEnDecoderSingleton } from "@vibes.diy/api-types";

const env = { ENVIRONMENT: "test" } as never;
const decode = (data: unknown) =>
  JSONEnDecoderSingleton()
    .asEnDecoder()
    .decode<{ payload: unknown }>(data as Uint8Array).payload;

function mkConn(keys: string[]) {
  const pair = TestWSPair.create();
  const provider = new WSSendProvider(pair.p2 as unknown as WebSocket);
  keys.forEach((k) => provider.subscribedDocKeys.add(k));
  const got: unknown[] = [];
  pair.p1.onmessage = (e: MessageEvent) => got.push(decode(e.data));
  return { provider, got };
}

describe("notifyDocEphemeral", () => {
  it("routes to co-channel peers by the SENDER's channel keys, skips the sender", async () => {
    const sender = mkConn(["alice/app1/default/notes"]);
    const peer = mkConn(["alice/app1/default/notes"]);
    const other = mkConn(["alice/app1/default/private"]); // different channel
    sender.provider.connId; // sender excluded by connId
    const connections = new Set([sender.provider, peer.provider, other.provider]);
    const cb = localBroadcastCallbacks(connections, env);

    await cb.notifyDocEphemeral(
      {
        ownerHandle: "alice",
        appSlug: "app1",
        dbName: "default",
        docId: "cursor-a",
        doc: { _id: "cursor-a", type: "cursor", curX: 5 },
      },
      sender.provider.connId
    );

    expect(peer.got).toHaveLength(1);
    expect(peer.got[0]).toMatchObject({
      type: "vibes.diy.evt-doc-ephemeral",
      dbName: "default",
      docId: "cursor-a",
      originPeer: sender.provider.connId,
      doc: { type: "cursor", curX: 5 },
    });
    expect(other.got).toHaveLength(0); // different channel — no delivery
    expect(sender.got).toHaveLength(0); // sender excluded
  });

  it("no bare-db leak: a bare-db-only peer does NOT receive a channel sender's ephemeral", async () => {
    const sender = mkConn(["alice/app1/default/notes"]);
    const bareDbPeer = mkConn(["alice/app1/default"]); // join-before-grant
    const connections = new Set([sender.provider, bareDbPeer.provider]);
    const cb = localBroadcastCallbacks(connections, env);

    await cb.notifyDocEphemeral(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "cursor-a", doc: { curX: 1 } },
      sender.provider.connId
    );

    expect(bareDbPeer.got).toHaveLength(0);
  });

  it("non-access-fn vibe: db-wide delivery via the bare-db key", async () => {
    const sender = mkConn(["alice/app1/default"]);
    const peer = mkConn(["alice/app1/default"]);
    const connections = new Set([sender.provider, peer.provider]);
    const cb = localBroadcastCallbacks(connections, env);

    await cb.notifyDocEphemeral(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", doc: { curX: 1 } },
      sender.provider.connId
    );
    expect(peer.got).toHaveLength(1);
  });

  it("drops an oversize snapshot (size cap) without delivering", async () => {
    const sender = mkConn(["alice/app1/default"]);
    const peer = mkConn(["alice/app1/default"]);
    const cb = localBroadcastCallbacks(new Set([sender.provider, peer.provider]), env);
    const big = { blob: "x".repeat(20000) };
    await cb.notifyDocEphemeral(
      { ownerHandle: "alice", appSlug: "app1", dbName: "default", docId: "d1", doc: big },
      sender.provider.connId
    );
    expect(peer.got).toHaveLength(0);
  });
});

describe("notifyDocEphemeralDrop", () => {
  it("broadcasts a drop for a departed peer to all connections", async () => {
    const a = mkConn(["alice/app1/default"]);
    const b = mkConn(["alice/app1/default"]);
    const cb = localBroadcastCallbacks(new Set([a.provider, b.provider]), env);
    await cb.notifyDocEphemeralDrop("gone-conn");
    expect(a.got[0]).toMatchObject({ type: "vibes.diy.evt-doc-ephemeral-drop", originPeer: "gone-conn" });
    expect(b.got[0]).toMatchObject({ type: "vibes.diy.evt-doc-ephemeral-drop", originPeer: "gone-conn" });
  });
});
```

> If `JSONEnDecoderSingleton().asEnDecoder().decode` isn't the exact decode call in `local-broadcast-doc-changed.test.ts`, copy that file's `decodePayload` helper verbatim instead.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/vibes.diy && npx vitest --run --project api-tests local-broadcast-ephemeral`
Expected: FAIL — `cb.notifyDocEphemeral` is not a function.

- [ ] **Step 3: Implement both callbacks**

In `vibes.diy/api/svc/cf-serve.ts`, add a constant near `HOT_VIBE_CONN_WARN_THRESHOLD` (L91):

```typescript
const EPHEMERAL_MAX_BYTES = 8 * 1024; // presence docs are tiny; a multi-KB ephemeral is misuse
const EPHEMERAL_MAX_PER_SEC = 60; // per-connection ceiling; drop + warn above this
```

Add a module-level rate tracker above `localBroadcastCallbacks`:

```typescript
// Per-connection ephemeral send timestamps for the circuit breaker. Keyed by
// senderConnId; a bounded sliding 1s window. Ephemerals only — never touches
// notifyDocChanged / persisted flows.
const ephemeralRateWindow = new Map<string, number[]>();
function ephemeralRateOk(senderConnId: string, nowMs: number): boolean {
  const win = (ephemeralRateWindow.get(senderConnId) ?? []).filter((t) => nowMs - t < 1000);
  if (win.length >= EPHEMERAL_MAX_PER_SEC) {
    ephemeralRateWindow.set(senderConnId, win);
    return false;
  }
  win.push(nowMs);
  ephemeralRateWindow.set(senderConnId, win);
  return true;
}
```

Inside the object returned by `localBroadcastCallbacks`, after the `notifyDocChanged` member (after L153), add:

```typescript
    notifyDocEphemeral: async (
      evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string; doc: Record<string, unknown> },
      senderConnId: string
    ): Promise<void> => {
      const dbKey = `${evt.ownerHandle}/${evt.appSlug}/${evt.dbName}`;
      // Size cap (drop + count).
      const encoded = JSON.stringify(evt.doc);
      if (encoded.length > EPHEMERAL_MAX_BYTES) {
        console.warn("[Sessions] ephemeral dropped: oversize", "key=", dbKey, "bytes=", encoded.length);
        return;
      }
      // Circuit breaker (drop + count) — ephemerals only.
      if (!ephemeralRateOk(senderConnId, Date.now())) {
        console.warn("[Sessions] ephemeral dropped: rate", "conn=", senderConnId.slice(0, 8));
        return;
      }
      // Route by the SENDER connection's own channel keys under this db — a peer
      // can only hold channel keys it was granted, so it can never route presence
      // beyond its own channels. Exact channel keys only; the bare-db fallback that
      // notifyDocChanged uses is UNSAFE here because the snapshot is the disclosure
      // (spec Piece 3 / #1756 P1).
      let sender: WSSendProvider | undefined;
      for (const conn of connections) if (conn.connId === senderConnId) sender = conn;
      const routeKeys = new Set<string>();
      if (sender) {
        for (const k of sender.subscribedDocKeys) {
          if (k === dbKey || k.startsWith(`${dbKey}/`)) routeKeys.add(k);
        }
      }
      // A test/external sender not in `connections` (senderConnId unknown) falls
      // back to the bare dbKey only — safe for non-access-fn vibes.
      if (routeKeys.size === 0) routeKeys.add(dbKey);
      if (shouldLog) {
        console.info("[Sessions] ephemeral fanout", "keys=", [...routeKeys].join(","), "conns=", connections.size);
      }
      const fullEvt = { type: "vibes.diy.evt-doc-ephemeral", originPeer: senderConnId, ...evt };
      for (const conn of connections) {
        if (conn.connId === senderConnId) continue;
        let match = false;
        for (const k of conn.subscribedDocKeys) if (routeKeys.has(k)) { match = true; break; }
        if (!match) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({ tid: crypto.randomUUID(), src: "vibes.diy.api", dst: "vibes.diy.client", ttl: 10, payload: fullEvt })
          )
        );
      }
    },
    notifyDocEphemeralDrop: async (originPeer: string): Promise<void> => {
      const fullEvt = { type: "vibes.diy.evt-doc-ephemeral-drop", originPeer };
      for (const conn of connections) {
        if (conn.connId === originPeer) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({ tid: crypto.randomUUID(), src: "vibes.diy.api", dst: "vibes.diy.client", ttl: 10, payload: fullEvt })
          )
        );
      }
    },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /home/user/vibes.diy && npx vitest --run --project api-tests local-broadcast-ephemeral`
Expected: PASS (5 tests). If the decode helper differs, align it with the sibling test and re-run.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/cf-serve.ts vibes.diy/api/tests/local-broadcast-ephemeral.test.ts
git commit -m "feat(1756): server ephemeral fan-out (exact-channel, size cap, rate breaker) + drop"
```

---

## Task 4: Inbound evento handler + manifest registration

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents-write-eventos.ts` — add `broadcastEphemeralEvento`
- Modify: `vibes.diy/api/svc/evento-handler-manifest.ts` — register it
- Modify: `vibes.diy/api/types` SHARD_POLICY (if `req-broadcast-ephemeral` must be declared there — see note)
- Test: `vibes.diy/api/tests/broadcast-ephemeral-handler.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Model on `subscribe-channel-keys.test.ts`. Create `vibes.diy/api/tests/broadcast-ephemeral-handler.test.ts` — set up two connections on one ctx (sender + peer both `subscribeDocs` the same db), have the sender send `req-broadcast-ephemeral`, assert the peer's `onDocEphemeral` fires with the snapshot and the sender's does not:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { Result, TestWSPair, ensureSuperThis } from "@adviser/cement";
import { localBroadcastCallbacks, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { createVibeDiyTestCtx, createTestDeviceCA, createTestUser } from "./vibe-diy-test-ctx.js";

// Sends a fire-and-forget req-broadcast-ephemeral over the raw ws and asserts
// the *other* connection's evt-doc-ephemeral listener fires.
describe("broadcastEphemeralEvento", () => {
  // beforeAll: build ctx with a no-access-fn vibe (invokeAccessFn omitted),
  // two VibesDiyApi clients on two WSSendProviders added to ctx.connections,
  // both call subscribeDocs({ ownerHandle, appSlug, dbName: "default" }).
  // (Copy the beforeAll wiring from subscribe-channel-keys.test.ts, making TWO
  //  client/provider pairs instead of one.)

  it("sender's ephemeral reaches the peer, not the sender; nothing persists", async () => {
    const got: unknown[] = [];
    peerApi.onDocEphemeral((evt) => got.push(evt));
    const senderGot: unknown[] = [];
    senderApi.onDocEphemeral((evt) => senderGot.push(evt));

    senderApi.broadcastEphemeral({
      ownerHandle,
      appSlug,
      dbName: "default",
      docId: "cursor-s",
      doc: { _id: "cursor-s", type: "cursor", curX: 9 },
    });

    await new Promise((r) => setTimeout(r, 150));
    expect(got.length).toBeGreaterThanOrEqual(1);
    expect(got[0]).toMatchObject({ docId: "cursor-s", doc: { curX: 9 } });
    expect(senderGot).toHaveLength(0);

    // Not persisted:
    const gd = await peerApi.getDoc({ ownerHandle, appSlug, dbName: "default", docId: "cursor-s" });
    expect(gd.isOk() && "status" in gd.Ok() ? gd.Ok().status : "not-found").not.toBe("ok");
  });
});
```

> `onDocEphemeral` and `broadcastEphemeral` are added to `VibesDiyApi` in Task 6; write this test now and let it drive both Task 4 and Task 6. Run it after Task 6 is done as the integration check. For a Task-4-only fast check, add an intermediate assertion at the handler level (below).

- [ ] **Step 2: Write the handler**

In `vibes.diy/api/svc/public/app-documents-write-eventos.ts`, add (mirroring `subscribeDocsEvento`'s shape and `putDoc`'s fan-out call):

```typescript
export const broadcastEphemeralEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqBroadcastEphemeral>, never> = {
  hash: "broadcast-ephemeral",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqBroadcastEphemeral(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: optAuth(async (ctx): Promise<Result<EventoResultType>> => {
    const req = ctx.validated.payload;
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    // Fire-and-forget relay. No persistence, no access-fn eval, no response.
    // Routing is derived server-side from the sender connection's channel keys
    // (see notifyDocEphemeral). The sender connId excludes the sender.
    vctx
      .notifyDocEphemeral?.(
        { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName: req.dbName, docId: req.docId, doc: req.doc },
        clientWsSend(ctx).connId
      )
      .catch((e: unknown) => console.error("ephemeral notify error:", e));
    return Result.Ok(EventoResult.Continue);
  }),
};
```

Add imports at the top of the file: `reqBroadcastEphemeral`, `ReqBroadcastEphemeral` from `@vibes.diy/api-types` (join the existing import block).

- [ ] **Step 3: Register in the manifest**

In `vibes.diy/api/svc/evento-handler-manifest.ts`, import `broadcastEphemeralEvento` alongside `putDocEvento`, and add to the vibe-shard block (after `subscribeDocsEvento`, ~L172):

```typescript
  entry("vibes.diy.req-broadcast-ephemeral", broadcastEphemeralEvento),
```

- [ ] **Step 4: Declare the shard policy for the req type**

`ReqType` and `SHARD_POLICY` in `@vibes.diy/api-types` are the source of truth for placement (see the manifest header comment). Grep for how `"vibes.diy.req-subscribe-docs"` appears in `SHARD_POLICY` and add `"vibes.diy.req-broadcast-ephemeral"` to the **same (vibe) shard set** the same way. Also confirm `ReqType` includes the new literal (it may derive from the req union automatically; if it's a manual union, add it).

Run: `cd /home/user/vibes.diy && grep -rn "req-subscribe-docs" vibes.diy/api/types/`
Expected: shows the SHARD_POLICY entry to mirror.

- [ ] **Step 5: Run the type/build check**

Run: `cd /home/user/vibes.diy && pnpm --filter @vibes.diy/api-svc build`
Expected: compiles. (Full handler test runs after Task 6.)

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents-write-eventos.ts vibes.diy/api/svc/evento-handler-manifest.ts vibes.diy/api/types vibes.diy/api/tests/broadcast-ephemeral-handler.test.ts
git commit -m "feat(1756): inbound broadcast-ephemeral evento handler + shard policy"
```

---

## Task 5: Disconnect drop hook in `cf-serve.ts`

**Files:**

- Modify: `vibes.diy/api/svc/cf-serve.ts` — the `close` and `error` listeners (~L560-577)

- [ ] **Step 1: Write the failing test**

Add to `vibes.diy/api/tests/local-broadcast-ephemeral.test.ts` a test that constructs the callbacks, simulates a connection close by calling the drop directly (the close-hook wiring is thin glue; the drop behavior itself is already covered in Task 3). For the hook wiring, assert via a small integration in `broadcast-ephemeral-handler.test.ts`: after `peerApi` subscribes and `senderApi`'s underlying ws closes, `peerApi.onDocEphemeralDrop` receives the sender's `connId`. (If closing a `TestWSPair` side is awkward, cover the hook by asserting `notifyDocEphemeralDrop` is invoked — see Step 3 note.)

- [ ] **Step 2: Wire the hook**

In `vibes.diy/api/svc/cf-serve.ts`, in BOTH the `close` and `error` listeners, immediately BEFORE `ws.connections.delete(wsSendProvider);`, add:

```typescript
// #1756: tell remaining peers to drop this connection's ephemeral overlay
// slices (presence vanishes on disconnect). Best-effort; never blocks close.
localBroadcastCallbacks(ws.connections, env)
  .notifyDocEphemeralDrop(wsSendProvider.connId)
  .catch((e: unknown) => console.error("ephemeral drop error:", e));
```

> `env` is in scope in `cf-serve` where the listeners are attached (same scope that constructs `wsSendProvider`); confirm the variable name (`env` / `this.env`) at that call site and match it. Emitting BEFORE the delete ensures the departing connection is still excluded by `connId` (it's skipped anyway) and all peers are still present.

- [ ] **Step 3: Run tests**

Run: `cd /home/user/vibes.diy && npx vitest --run --project api-tests local-broadcast-ephemeral`
Expected: PASS. (If the close-hook integration assertion is flaky due to TestWSPair close semantics, keep the drop-behavior unit test from Task 3 as the guarantee and leave a `// covered by unit test` note.)

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/svc/cf-serve.ts vibes.diy/api/tests/local-broadcast-ephemeral.test.ts
git commit -m "feat(1756): emit ephemeral-drop on connection close/error"
```

---

## Task 6: Client transport — send path + event bridges

**Files:**

- Modify: `vibes.diy/api/impl/index.ts` — `VibesDiyApi.broadcastEphemeral` (fire-and-forget) + `onDocEphemeral` + `onDocEphemeralDrop`
- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts` — `broadcastEphemeral` + bridge both events into `onMsg`
- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts` — `VibeSandboxApi.broadcastEphemeral` (postMessage) + surface events through `onMsg`
- Modify: `vibes.diy/vibe/runtime/firefly-database.ts` — add `broadcastEphemeral` to `FireflyTransport`

- [ ] **Step 1: Add `broadcastEphemeral` to `VibesDiyApi` (fire-and-forget)**

In `vibes.diy/api/impl/index.ts`, add a method that sends the req without awaiting a response, using the same low-level path as `vibes-diy-api-transport.ts` (`getReadyConnection` → encode MsgBase → `conn.send`):

```typescript
  broadcastEphemeral(req: Req<ReqBroadcastEphemeral>): void {
    // Fire-and-forget: no response is sent by the server, and we never await.
    // Best-effort — if the connection isn't ready, drop this frame (the next
    // merge() coalesced frame will carry the latest snapshot anyway).
    const conn = this.currentConnection;
    const msg = { ...req, type: "vibes.diy.req-broadcast-ephemeral" as const };
    const ende = JSONEnDecoderSingleton();
    const send = (c: VibeDiyApiConnection) => {
      const box = { src: this.cfg.apiUrl, dst: this.cfg.me, ttl: 6, tid: crypto.randomUUID(), payload: msg };
      c.send(ende.uint8ify(box));
    };
    if (conn) {
      send(conn);
    } else {
      this.getReadyConnection().then(send).catch(() => undefined);
    }
  }
```

> Match `this.cfg.apiUrl` / `this.cfg.me` to the real field names used in `vibes-diy-api-transport.ts` (`ctx.cfg.apiUrl`, `ctx.cfg.me`). If `Req<>` includes `auth`, keep it (the `optAuth` handler tolerates its absence for a public presence vibe; auth rides along when present).

- [ ] **Step 2: Add `onDocEphemeral` / `onDocEphemeralDrop` to `VibesDiyApi`**

Mirror `onDocChanged` (index.ts:949-969) and its `attachDocChangedToConnectionImpl`. Add `docEphemeralListeners` / `docEphemeralDropListeners` arrays, `onDocEphemeral(fn)` / `onDocEphemeralDrop(fn)` registration returning an unsubscribe, and extend the per-connection message dispatch (where `evt-doc-changed` is recognized — find `isEvtDocChanged` usage inside the connection message handler) to also recognize `isEvtDocEphemeral` → call `docEphemeralListeners` with the full `EvtDocEphemeral`, and `isEvtDocEphemeralDrop` → call `docEphemeralDropListeners` with `originPeer`.

Run: `grep -n "isEvtDocChanged\|attachDocChangedToConnection" vibes.diy/api/impl/*.ts` to find the exact dispatch site to extend.

- [ ] **Step 3: Bridge into `FireflyApiAdapter.onMsg` + add `broadcastEphemeral`**

In `vibes.diy/api/impl/firefly-api-adapter.ts`, extend `onMsg` (L271-287) so the registered `register(api)` also wires the two new events into the `{ data: {...} }` shape FireflyDatabase expects:

```typescript
api.onDocEphemeral((evt) => fn({ data: evt }));
api.onDocEphemeralDrop((originPeer) => fn({ data: { type: "vibes.diy.evt-doc-ephemeral-drop", originPeer } }));
```

And add the transport method (mirror `subscribeDocs`, L160-173):

```typescript
  broadcastEphemeral(docId: string, doc: Record<string, unknown>, dbName = "default"): void {
    const api = typeof this.apiArg !== "function" ? this.apiArg : undefined;
    const ownerHandle = this.svc.vibeApp.ownerHandle;
    const send = (a: VibesDiyApi) =>
      a.broadcastEphemeral({ appSlug: this.svc.vibeApp.appSlug, ownerHandle, dbName, docId, doc });
    if (api) send(api);
    else this.getApi().then(send).catch(() => undefined);
  }
```

> Fire-and-forget: no `await this.resolveOwnerHandle()` in the hot path. Use the already-backfilled `svc.vibeApp.ownerHandle` (presence starts after mount, by which point it's resolved). If empty at first call, that frame drops and the next coalesced frame sends.

- [ ] **Step 4: Add `broadcastEphemeral` to `VibeSandboxApi` (iframe, postMessage)**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, add (fire-and-forget: `postMessage` directly, NOT `request()`):

```typescript
  broadcastEphemeral(docId: string, doc: Record<string, unknown>, dbName = "default"): void {
    // Fire-and-forget: no tid correlation, no await. Gate on ack so we don't
    // post into a void before the host listener exists; drop if not yet acked.
    if (!this.acked) return;
    this.svc.postMessage(
      { tid: crypto.randomUUID(), type: "vibes.diy.req-broadcast-ephemeral", ...this.svc.vibeApp, dbName, docId, doc },
      "*"
    );
  }
```

The host side already forwards `req-*` messages to the server evento and pushes `evt-*` back through `onMsg`; confirm the host bridge forwards unknown `req-broadcast-ephemeral` the same way it forwards `req-subscribe-docs` (grep the host postMessage router). The inbound `evt-doc-ephemeral(-drop)` already flow through `VibeSandboxApi.onMsg` (the generic handler at L104), so no receive change is needed here.

- [ ] **Step 5: Add `broadcastEphemeral` to the `FireflyTransport` interface**

In `vibes.diy/vibe/runtime/firefly-database.ts`, add to the `FireflyTransport` interface (after `subscribeDocs`, L44):

```typescript
  broadcastEphemeral(docId: string, doc: Record<string, unknown>, dbName?: string): void;
```

- [ ] **Step 6: Run the handler integration test from Task 4**

Run: `cd /home/user/vibes.diy && npx vitest --run --project api-tests broadcast-ephemeral-handler`
Expected: PASS — sender's ephemeral reaches the peer, not the sender, and nothing persists.

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/api/impl/index.ts vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/vibe/runtime/firefly-database.ts vibes.diy/api/tests/broadcast-ephemeral-handler.test.ts
git commit -m "feat(1756): client broadcastEphemeral send path + ephemeral event bridges"
```

---

## Task 7: Receiver overlay in `FireflyDatabase`

**Files:**

- Modify: `vibes.diy/vibe/runtime/firefly-database.ts` — overlay state, onMsg handler, `get`/`query`/`allDocs` fold, TTL, drop, defense-in-depth gate
- Test: `vibes.diy/tests/app/firefly-ephemeral-overlay.test.ts` (create; mirror `firefly-database.test.ts`)

- [ ] **Step 1: Extend the mock transport**

In `vibes.diy/tests/app/mock-vibe-api.ts`, add to the interface + impl:

```typescript
  broadcastEphemeral(docId: string, doc: Record<string, unknown>, dbName?: string): void;
  /** Test helper: simulate an inbound evt-doc-ephemeral from a peer */
  _simulateEphemeral(docId: string, doc: Record<string, unknown>, opts?: { dbName?: string; originPeer?: string; channel?: string }): void;
  /** Test helper: simulate an inbound evt-doc-ephemeral-drop */
  _simulateEphemeralDrop(originPeer: string): void;
```

Impl of `_simulateEphemeral` (mirror `_simulateDocChanged`, mock-vibe-api.ts L110):

```typescript
  _simulateEphemeral(docId, doc, opts = {}) {
    this._msgListeners.forEach((fn) =>
      fn({
        data: {
          type: "vibes.diy.evt-doc-ephemeral",
          ownerHandle: "test-user",
          appSlug: this._appSlug,
          dbName: opts.dbName ?? "testdb",
          docId,
          originPeer: opts.originPeer ?? "peer-1",
          doc,
          ...(opts.channel ? { channel: opts.channel } : {}),
        },
      })
    );
  },
  _simulateEphemeralDrop(originPeer) {
    this._msgListeners.forEach((fn) => fn({ data: { type: "vibes.diy.evt-doc-ephemeral-drop", originPeer } }));
  },
  broadcastEphemeral() {/* no-op in mock */},
```

(Match the mock's existing listener-array name; the report shows it invokes `fn(...)` directly — reuse that mechanism.)

- [ ] **Step 2: Write the failing tests**

Create `vibes.diy/tests/app/firefly-ephemeral-overlay.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FireflyDatabase } from "../../vibe/runtime/firefly-database.js";
import { createMockVibeApi, asSandboxApi, type MockVibeApi } from "./mock-vibe-api.js";

describe("FireflyDatabase ephemeral overlay", () => {
  let mockApi: MockVibeApi;
  let db: FireflyDatabase;
  beforeEach(() => {
    mockApi = createMockVibeApi("test-app");
    db = new FireflyDatabase("testdb", asSandboxApi(mockApi));
  });

  it("folds an ephemeral snapshot into get() for an overlay-only _id", async () => {
    mockApi._simulateEphemeral("cursor-a", { _id: "cursor-a", type: "cursor", curX: 7 });
    const doc = await db.get("cursor-a");
    expect(doc).toMatchObject({ _id: "cursor-a", type: "cursor", curX: 7 });
  });

  it("overlay-only _id appears as a query() row (carries indexed field)", async () => {
    mockApi._simulateEphemeral("cursor-a", { _id: "cursor-a", type: "cursor", curX: 7 });
    const res = await db.query("type", { key: "cursor", includeDocs: true });
    expect(res.docs.map((d: { _id: string }) => d._id)).toContain("cursor-a");
  });

  it("last-write-wins on a shared _id", async () => {
    mockApi._simulateEphemeral("shared", { _id: "shared", type: "c", v: 1 }, { originPeer: "p1" });
    mockApi._simulateEphemeral("shared", { _id: "shared", type: "c", v: 2 }, { originPeer: "p2" });
    expect((await db.get("shared")).v).toBe(2);
  });

  it("drop removes only the departed peer's slices", async () => {
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" }, { originPeer: "p1" });
    mockApi._simulateEphemeral("c-b", { _id: "c-b", type: "cursor" }, { originPeer: "p2" });
    mockApi._simulateEphemeralDrop("p1");
    const rows = (await db.query("type", { key: "cursor", includeDocs: true })).docs.map((d: { _id: string }) => d._id);
    expect(rows).toContain("c-b");
    expect(rows).not.toContain("c-a");
  });

  it("notifies listeners on inbound ephemeral so hooks refetch", () => {
    const listener = vi.fn();
    db.subscribe(listener);
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" });
    expect(listener).toHaveBeenCalledWith([expect.objectContaining({ _id: "c-a" })]);
  });

  it("TTL backstop purges a stale slice with no drop event", async () => {
    vi.useFakeTimers();
    mockApi._simulateEphemeral("c-a", { _id: "c-a", type: "cursor" }, { originPeer: "p1" });
    vi.advanceTimersByTime(20_000); // > TTL
    // A read after TTL should not include the expired slice.
    const rows = (await db.query("type", { key: "cursor", includeDocs: true })).docs.map((d: { _id: string }) => d._id);
    expect(rows).not.toContain("c-a");
    vi.useRealTimers();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd /home/user/vibes.diy && npx vitest --run firefly-ephemeral-overlay`
Expected: FAIL — overlay not implemented; `get("cursor-a")` throws not-found.

- [ ] **Step 4: Implement the overlay**

In `vibes.diy/vibe/runtime/firefly-database.ts`:

Add imports: `isEvtDocEphemeral`, `isEvtDocEphemeralDrop`, `type EvtDocEphemeral` from `@vibes.diy/vibe-types`.

Add a TTL constant near the top:

```typescript
const EPHEMERAL_TTL_MS = 12_000; // slice backstop for unclean disconnects (#1756)
```

Add fields to the class (near `listeners`, L136):

```typescript
  private readonly ephemeralOverlay = new Map<string, { doc: DocWithId; originPeer: string; seq: number; at: number }>();
  private readonly peerDocs = new Map<string, Set<string>>();
  private ephemeralSeq = 0;
```

Add a private helper to purge expired slices (called at the start of every read + on notify):

```typescript
  private pruneEphemeral(): string[] {
    const now = Date.now();
    const dropped: string[] = [];
    for (const [docId, slice] of this.ephemeralOverlay) {
      if (now - slice.at > EPHEMERAL_TTL_MS) {
        this.ephemeralOverlay.delete(docId);
        this.peerDocs.get(slice.originPeer)?.delete(docId);
        dropped.push(docId);
      }
    }
    return dropped;
  }
```

In the constructor `onMsg` handler (L158-168), AFTER the existing `isEvtDocChanged` block, add:

```typescript
if (
  isEvtDocEphemeral(data) &&
  data.ownerHandle === this.vibeApp.ownerHandle &&
  data.appSlug === this.vibeApp.appSlug &&
  data.dbName === this.name
) {
  // Defense-in-depth (#1756 P1): server routing is the primary gate; also
  // drop an ephemeral whose channel isn't currently readable. `channel`
  // absent (non-access-fn vibe) is always allowed.
  if (!data.channel || this.readableChannels().has(data.channel)) {
    this.applyEphemeral(data);
  }
}
if (isEvtDocEphemeralDrop(data)) {
  this.dropPeer(data.originPeer);
}
```

Add the apply/drop/readable helpers:

```typescript
  private readableChannels(): Set<string> {
    // Best-effort: the runtime exposes the viewer's granted channels for this db.
    // If unavailable in this context, treat as "allow" (routing already gated).
    return this.grantedChannels ?? new Set<string>();
  }

  private applyEphemeral(evt: EvtDocEphemeral): void {
    const docId = evt.docId;
    const doc = { ...evt.doc, _id: docId } as DocWithId;
    this.ephemeralOverlay.set(docId, { doc, originPeer: evt.originPeer, seq: ++this.ephemeralSeq, at: Date.now() });
    let set = this.peerDocs.get(evt.originPeer);
    if (!set) { set = new Set(); this.peerDocs.set(evt.originPeer, set); }
    set.add(docId);
    this.notifyListeners([{ _id: docId } as DocWithId]);
  }

  private dropPeer(originPeer: string): void {
    const docs = this.peerDocs.get(originPeer);
    if (!docs) return;
    const affected: DocWithId[] = [];
    for (const docId of docs) {
      const slice = this.ephemeralOverlay.get(docId);
      if (slice && slice.originPeer === originPeer) {
        this.ephemeralOverlay.delete(docId);
        affected.push({ _id: docId } as DocWithId);
      }
    }
    this.peerDocs.delete(originPeer);
    if (affected.length) this.notifyListeners(affected);
  }
```

> `grantedChannels` wiring: add an optional `grantedChannels?: Set<string>` field settable via a small method the hook calls from `viewerEnv.grants` (mirror `applyAcl`). If threading grants here is heavier than expected during implementation, ship the `!data.channel` allow-path and leave `readableChannels()` returning an empty set is WRONG (would drop all channel ephemerals) — instead default it to "allow" by returning the channel itself; capture the grant wiring as a follow-up and note it. Keep server routing as the guarantee.

Fold the overlay into reads. In `get(id)` (L221-235), before `throw`ing not-found and after a successful get, merge the overlay:

```typescript
  async get<T extends DocTypes>(id: string): Promise<DocWithId<T>> {
    this.pruneEphemeral();
    const overlay = this.ephemeralOverlay.get(id);
    const rRes = await this.vibeApi.getDoc(id, this.name);
    if (rRes.isErr()) {
      if (overlay) return { ...overlay.doc } as DocWithId<T>; // overlay-only
      throw new Error(`Failed to get document: ${errMsg(rRes.Err())}`);
    }
    const res = rRes.Ok();
    if (isResGetDoc(res)) {
      const decorated = decorateFiles({ ...res.doc, _id: res.id });
      return { ...decorated, ...(overlay ? overlay.doc : {}) } as DocWithId<T>;
    }
    if (overlay) return { ...overlay.doc } as DocWithId<T>; // not-found but overlaid
    throw new Error(`Failed to get document: ${JSON.stringify(res)}`);
  }
```

In `query()` (after `allDocs` are built, ~L329) and `allDocs()` (after `docs` built, ~L449), fold overlay slices in before the map/filter/sort: merge overlay onto a matching persisted doc by `_id`, and append synthesized rows for overlay-only `_id`s. Add a shared private helper:

```typescript
  private mergeOverlayDocs(docs: DocWithId[]): DocWithId[] {
    this.pruneEphemeral();
    if (this.ephemeralOverlay.size === 0) return docs;
    const byId = new Map(docs.map((d) => [d._id, d] as const));
    for (const [docId, slice] of this.ephemeralOverlay) {
      const base = byId.get(docId);
      byId.set(docId, { ...(base ?? {}), ...slice.doc, _id: docId } as DocWithId);
    }
    return [...byId.values()];
  }
```

Call `const allDocs = this.mergeOverlayDocs(res.docs.map((d) => decorateFiles({ ...d, _id: d._id }) as DocWithId));` at the top of the `query`/`allDocs` doc-assembly (replace the existing `res.docs.map(...)` initialization).

- [ ] **Step 5: Run to verify pass**

Run: `cd /home/user/vibes.diy && npx vitest --run firefly-ephemeral-overlay`
Expected: PASS (6 tests). Also re-run the existing `firefly-database.test.ts` to confirm no regression:
Run: `cd /home/user/vibes.diy && npx vitest --run firefly-database`

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/firefly-database.ts vibes.diy/tests/app/mock-vibe-api.ts vibes.diy/tests/app/firefly-ephemeral-overlay.test.ts
git commit -m "feat(1756): FireflyDatabase ephemeral overlay (fold into reads, TTL, drop, gate)"
```

---

## Task 8: `merge()` broadcast leg + per-`_id` coalescer

**Files:**

- Create: `vibes.diy/vibe/runtime/merge-coalescer.ts`
- Modify: `vibes.diy/vibe/runtime/use-firefly.ts:193-196` (`merge`)
- Test: `vibes.diy/tests/app/merge-coalescer.test.ts` (create); extend `use-firefly` behavior test if present

- [ ] **Step 1: Write the coalescer test**

Create `vibes.diy/tests/app/merge-coalescer.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { createEphemeralCoalescer } from "../../vibe/runtime/merge-coalescer.js";

describe("ephemeral coalescer", () => {
  it("collapses a burst per _id to one flush with the latest snapshot", () => {
    vi.useFakeTimers();
    const sent: { id: string; doc: Record<string, unknown> }[] = [];
    const c = createEphemeralCoalescer((id, doc) => sent.push({ id, doc }), 16);
    c.push("cursor-a", { _id: "cursor-a", curX: 1 });
    c.push("cursor-a", { _id: "cursor-a", curX: 2 });
    c.push("cursor-a", { _id: "cursor-a", curX: 3 });
    expect(sent).toHaveLength(0); // nothing sent synchronously
    vi.advanceTimersByTime(16);
    expect(sent).toEqual([{ id: "cursor-a", doc: { _id: "cursor-a", curX: 3 } }]);
    vi.useRealTimers();
  });

  it("does not collapse distinct _ids together", () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const c = createEphemeralCoalescer((id) => sent.push(id), 16);
    c.push("a", { _id: "a" });
    c.push("b", { _id: "b" });
    vi.advanceTimersByTime(16);
    expect(sent.sort()).toEqual(["a", "b"]);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd /home/user/vibes.diy && npx vitest --run merge-coalescer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the coalescer**

Create `vibes.diy/vibe/runtime/merge-coalescer.ts`:

```typescript
// Per-_id coalescer for ephemeral merge broadcasts (#1756). Collapses a burst
// (e.g. 60Hz cursor moves) to one send per frame, keeping the latest snapshot
// per _id. Uses setTimeout(delayMs) rather than rAF so it works in the iframe,
// Node, and tests (fake timers). Distinct _ids flush independently on the same
// tick but are never merged together.
export function createEphemeralCoalescer(
  flush: (docId: string, doc: Record<string, unknown>) => void,
  delayMs = 16
): { push: (docId: string, doc: Record<string, unknown>) => void; cancel: () => void } {
  const pending = new Map<string, Record<string, unknown>>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    timer = undefined;
    const batch = [...pending.entries()];
    pending.clear();
    for (const [id, doc] of batch) flush(id, doc);
  };
  return {
    push(docId, doc) {
      pending.set(docId, doc); // latest wins per _id
      if (timer === undefined) timer = setTimeout(run, delayMs);
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending.clear();
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd /home/user/vibes.diy && npx vitest --run merge-coalescer`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire the coalescer into `merge()`**

In `vibes.diy/vibe/runtime/use-firefly.ts`, inside `createUseDocument` (before the returned hook or inside it via `useMemo`), create one coalescer per hook instance bound to the database:

```typescript
const coalescer = useMemo(() => createEphemeralCoalescer((id, snapshot) => database.broadcastEphemeral(id, snapshot)), [database]);
useEffect(() => () => coalescer.cancel(), [coalescer]);
```

Replace `merge` (L193-196) with:

```typescript
const merge = useCallback(
  (newDoc: Record<string, unknown>) => {
    updateHappenedRef.current = true;
    setDoc((prev) => {
      const next = { ...prev, ...newDoc };
      if (next._id) coalescer.push(next._id as string, next); // #1756 broadcast leg
      return next;
    });
  },
  [coalescer]
);
```

Add imports at the top of `use-firefly.ts`: `createEphemeralCoalescer` from `./merge-coalescer.js` (and ensure `useMemo`/`useEffect` are imported — they already are).

- [ ] **Step 6: Run the full app suite for the hook**

Run: `cd /home/user/vibes.diy && npx vitest --run --project app use-firefly` (and any existing `use-document`/hook test)
Expected: PASS; existing merge/save behavior unchanged (broadcast is additive and only fires when `_id` present).

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/vibe/runtime/merge-coalescer.ts vibes.diy/vibe/runtime/use-firefly.ts vibes.diy/tests/app/merge-coalescer.test.ts
git commit -m "feat(1756): merge() ephemeral broadcast leg + per-_id coalescer"
```

---

## Task 9: App-facing recipe docs + full verification

**Files:**

- Modify: `notes/vibes-app-jsx.md` (the app-authoring guide) — add a "Live presence with merge()" section
- Verify: full check

- [ ] **Step 1: Document the presence recipe**

Add a short section to `notes/vibes-app-jsx.md`:

````markdown
### Live presence (cursors, typing, selection)

`merge()` on a doc that has an `_id` broadcasts the doc to other connected
peers as an ephemeral overlay — no persistence, no `save()`. Give each peer a
stable `_id` and read the room with `useLiveQuery`:

```jsx
const { merge } = useDocument({ _id: `cursor-${myHandle}`, type: "cursor", curX: 0, curY: 0 });
onMouseMove = (e) => merge({ curX: e.clientX, curY: e.clientY });
const others = useLiveQuery("type", { key: "cursor" }).docs;
```
````

- Broadcasts only when the doc has an `_id`. A form draft with no `_id` stays
  page-local until `save()`.
- **Private drafts:** a form editing an existing `_id`'d doc broadcasts
  in-progress keystrokes to peers. Keep private drafts page-local (no `_id`, or
  local component state) until `save()`.
- Peers' ephemeral docs vanish automatically when they disconnect.
- For a one-shot flag like "typing", refresh it periodically while active (it
  expires after ~12s of silence).

````

- [ ] **Step 2: Full check**

Run: `cd /home/user/vibes.diy && pnpm fast-check`
Expected: prettier clean, build + lint pass. Then targeted suites:
Run: `cd /home/user/vibes.diy && npx vitest --run --project api-tests ephemeral && npx vitest --run --project api-tests local-broadcast-ephemeral && npx vitest --run --project api-tests broadcast-ephemeral-handler && npx vitest --run firefly-ephemeral-overlay && npx vitest --run merge-coalescer`
Expected: all PASS.

- [ ] **Step 3: Manual two-tab check (optional but recommended)**

Deploy the PR preview (or run locally), open a cursor vibe in two tabs signed in as different handles, confirm: A's cursor tracks live on B; closing A removes A's cursor on B within ~12s; reloading B shows no persisted cursor docs.

- [ ] **Step 4: Commit + push**

```bash
git add notes/vibes-app-jsx.md
git commit -m "docs(1756): live presence recipe for vibe authors"
git push origin claude/brainstorm-1756-evwod8
````

---

## Self-review notes (author → implementer)

- **Spec coverage:** Wire (Task 1), sender leg + coalescer (Tasks 6, 8), server relay + size cap + circuit breaker + metrics (Task 3), receiver overlay + read-fold + defense-in-depth (Task 7), disconnect close-hook + TTL backstop (Tasks 5, 7), flag-free `_id` gate + docs (Tasks 8, 9). All spec pieces map to a task.
- **Two spec reconciliations happen in-plan:** drop event shape simplified to `{ originPeer }` (Task 1 Step 5), and the routing mechanism made concrete (route by sender's own channel keys; Task 3). Fold both back into the spec doc in the same PR.
- **Type consistency:** wire field is `doc` everywhere (not `partial`); transport method is `broadcastEphemeral(docId, doc, dbName?)` on all three transports + `FireflyTransport`; overlay slice shape `{ doc, originPeer, seq, at }` is used identically in `applyEphemeral`, `dropPeer`, `pruneEphemeral`, `mergeOverlayDocs`.
- **Known implementation risk to confirm early:** the `grantedChannels` wiring for the receiver defense-in-depth gate (Task 7). If threading viewer grants into `FireflyDatabase` is nontrivial, ship the server-routing guarantee + the `!channel` allow-path, and file a follow-up for the client-side channel check rather than blocking. Do NOT leave `readableChannels()` returning empty (it would drop all channel ephemerals).
