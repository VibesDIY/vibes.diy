# Live doc-changed re-subscribe + re-query on grant change — design

**Date:** 2026-06-09
**Related:** [`2026-06-09-livequery-viewer-ready-refetch-design.md`](2026-06-09-livequery-viewer-ready-refetch-design.md) (defect A; this is the live-update sibling). The "live cross-instance fanout gap" framing in that spec (and the `DocNotify`/#2265 references) is **stale** — see Architecture below.
**Status:** approved design, pending implementation

## Problem

A **non-owner reader** of a vibe does not receive a **live** update when another device or user writes a **new document that grants the reader access**. The document is fully readable — a manual page refresh shows it — but it never appears live. Reproduces both as two different users and as one user on two devices (the second device acting as a reader).

Concretely: reader is looking at the app, someone writes a doc that grants them access, and nothing changes on screen until they reload.

It is **not** an owner problem (the owner is unaffected), **not** a grants/ACL problem (a refresh returns the doc, so the server grant computation is correct), and **not** a missing cross-instance coordinator. It is purely a missing **live** re-read on the client.

## Architecture (why this is same-DO, and why no coordinator is needed — ever)

Firefly document sync runs over `vibeApi` on the `app-api` route. The client opens **one** WebSocket per vibe app:

- Client: `/api/app?vibe=${ownerHandle}--${appSlug}` ([`vibes-diy-provider.tsx:239`](../../../vibes.diy/pkg/app/vibes-diy-provider.tsx), `skipShard: true`).
- Server: `env.APP_SESSIONS.idFromName(vibe)` ([`app.ts:101`](../../../vibes.diy/pkg/workers/app.ts)).

Because the DO id is `idFromName(ownerHandle--appSlug)`, **every client of a given vibe lands on the same `AppSessions` Durable Object instance, by construction.** Writes travel over that same WebSocket and are handled inside that DO via `appMsgEvento`; `notifyDocChanged` broadcasts to `this.connections` ([`app-sessions.ts:144,157`](../../../vibes.diy/pkg/workers/app-sessions.ts), [`cf-serve.ts:91-114`](../../../vibes.diy/api/svc/cf-serve.ts)). The DO uses plain `server.accept()` ([`cf-serve.ts:477`](../../../vibes.diy/api/svc/cf-serve.ts)) — **not** hibernation — so `this.connections` persists while the sockets are open.

Therefore a single-vibe local broadcast is **permanently sufficient**. A cross-vibe / cross-DO coordinator (the old dead `DocNotify` DO; #2265) is an explicit **non-goal** — it will not be built. The stale comment "with UUID sharding each DO has 1 connection" in [`cf-serve.ts`](../../../vibes.diy/api/svc/cf-serve.ts) predates the per-vibe `AppSessions` split and no longer reflects reality.

## Root cause

Doc-changed delivery matches a write's notify key against each connection's `subscribedDocKeys`. For an **access-fn** vibe those keys are **channel-scoped**, and the subscription is a **static snapshot taken once**:

1. **Writes always notify per-channel.** Access-fn writes must place the doc in ≥1 channel (zero-channel writes are rejected, [`app-documents-write-eventos.ts:85-105`](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts)), so `notifyDocChanged` emits `ownerHandle/appSlug/<channel>` keys and never the bare `dbName` key ([`app-documents-write-eventos.ts:461-469`](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts)). The canonical access-fn pattern keys channels **per document** (`return { channels: [doc._id], … }`, [`:98`](../../../vibes.diy/api/svc/public/app-documents-write-eventos.ts)) — so each new doc lands in a brand-new channel named after its own `_id`.

2. **A reader subscribes to its effective channels at subscribe time.** The non-owner branch computes `effectiveChannels` + `publicChannels` from current access-fn outputs ([`app-documents-read-eventos.ts:470-505`](../../../vibes.diy/api/svc/public/app-documents-read-eventos.ts)) and stores them in `subscribedDocKeys`. `subscribeDocs(name)` is called **once**, in the `FireflyDatabase` constructor ([`firefly-database.ts:122`](../../../vibes.diy/vibe/runtime/firefly-database.ts)), and never again.

So when a write **newly grants** the reader access, the doc is in a channel the reader never snapshotted; `notifyDocChanged` skips them. The reader **does** receive a separate `viewer-grants-changed` event — the parent route subscribes to it and, on receipt, calls `refreshViewerFromWhoAmI()`, updating `viewerEnv.grants` ([`vibe.$ownerHandle.$appSlug.tsx:459-467`](../../../vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx)). But on the Firefly side, **nothing acts on it**:

- **No re-query.** The viewer-ready re-fire key from the defect-A fix is `userHandle:access` ([`use-firefly.ts`](../../../vibes.diy/vibe/runtime/use-firefly.ts)). A new doc-grant **does not change the access level** (the reader stays "viewer"), so the key is stable and `refreshRows`/`refresh` never re-runs.
- **No re-subscribe.** `subscribeDocs` is never re-called, so the reader's server-side channel snapshot stays frozen and even subsequent edits to the new doc/channel are filtered out.

A **no-access-fn** vibe is unaffected: both sides use the bare `dbName` key, so they always match and live updates work.

## Goal

When the reader's effective grants change, make the newly-readable document(s) appear **live**, and keep them live for subsequent edits — by acting on the `viewer-grants-changed` signal the reader already receives. Client-only; no server change; no coordinator.

## Approach

On a grants change (the existing `viewer-grants-changed → pushViewerChanged(grants)` path), the iframe runtime does **two** things:

1. **Re-subscribe.** Re-call `subscribeDocs(name)` for each open `FireflyDatabase`. This refreshes the server-side channel snapshot so **future** edits to the newly-granted doc/channel push live. `subscribeDocs` already deduplicates by key on the client, so re-calling on reconnect/replay is safe.

2. **Re-query (companion).** Re-fire the read hooks once. This catches the **triggering** document itself, which was written before the re-subscribe could land — without it, the first newly-granted doc would still require a manual refresh and only later edits would go live. Implemented by widening the hooks' re-fire signal from `userHandle:access` to also reflect a **grants signature for this db**, so a new grant re-runs `refreshRows`/`refresh`.

Both ride the proven `viewerEnv` reactive path (the same rationale as the defect-A fix: `viewerEnv` is updated by `VibeContext`'s window-`message` listener, which reliably catches the post-`whoAmI` push), not the `onMsg` postMessage path.

### Components and data flow

```
write grants reader access
  └─ server: effectiveViewerGrantsChanged → notifyViewerGrantsChanged (owner/app key)   [unchanged]
       └─ parent route: onViewerGrantsChanged → refreshViewerFromWhoAmI
            └─ pushViewerChanged({ viewer, access, grants })  → iframe window message     [unchanged]
                 └─ VibeContext: setViewerEnv({ …, grants })                              [unchanged]
                      ├─ use-firefly hooks: grants-signature changes → refreshRows/refresh  ← NEW (re-query)
                      └─ FireflyDatabase: grants change → subscribeDocs(name)               ← NEW (re-subscribe)
```

### Where each change lands

- **`use-firefly.ts`** — extend the existing `viewerKey` (`userHandle:access`) used by `useLiveQuery`, `useAllDocs`, `useChanges`, and `useDocument` to also incorporate a stable **per-db grants signature** derived from `viewerEnv.grants`. Only the db-relevant slice of grants should feed the signature so unrelated grant churn doesn't re-fire every db's queries.
- **`firefly-database.ts` / runtime wiring** — when the viewer's grants change, re-issue `subscribeDocs(this.name)` for each live `FireflyDatabase`. The grants signal is observed through the same `viewerEnv` path `VibeContext` already exposes (not the DB's `onMsg`), so the boot-vs-runtime signal concern from defect A does not apply. Exact wiring (a `VibeContext` effect that walks the active databases vs. a per-database subscription to a viewer-changed callback) is an implementation-plan decision; the requirement is: a grants change re-subscribes every open db exactly once.

## Risk / correctness

- **Re-fire churn.** Widening the key re-runs queries when grants change. Grant changes are infrequent; steady state (no grant change) is unchanged. The per-db grants signature keeps an unrelated db's grant change from re-firing this db's queries.
- **Reader's own writes.** A reader writing a doc that grants themselves access changes their own grants and will re-fire/re-subscribe; this is idempotent and harmless (the local write already updated the view via `notifyListeners`).
- **`subscribeDocs` re-call cost.** One extra subscribe round-trip per open db per grants change. Bounded and infrequent. Client-side dedupe prevents duplicate server registrations from corrupting `subscribedDocKeys`.
- **No leak.** Re-subscribe recomputes the reader's effective channels server-side under their current grants — it cannot widen what they receive beyond what they may read.

## Verification

1. **Failing test first.** A reader connection subscribes to a db; a write grants it a new doc in a new per-doc channel. Assert: today the read result does not update without a manual re-query (the regression guard that fails on `main`); after the fix, the `viewer-grants-changed` signal re-fires the read query (doc appears) and re-issues `subscribeDocs` (a follow-up edit to that doc then pushes live). Use the existing `createVibeDiyTestCtx` two-connection harness rather than new infrastructure.
2. **CLI smoke.** Against an access-fn test vibe (`npx vibes-diy`): one `db subscribe` stream as the reader connection, a `db put` of a newly-granting doc as the writer connection; confirm the change surfaces live after the fix.
3. **No-access-fn control.** A no-access-fn vibe must remain correct (no regression): single-device load and two-device live update, which already work via the `dbName` key.

## Out of scope

- **New public-channel docs that carry no grant delta.** A write that adds a publicly-readable doc with no change to any specific reader's grants emits no `viewer-grants-changed`, so it is not covered by this signal. Tracked separately if it proves to matter in practice.
- **Cross-vibe / cross-DO live fanout (the coordinator).** A **non-goal** by design: the per-vibe `AppSessions` DO guarantees all clients of a vibe share one instance, so local broadcast is permanently sufficient. The dead `DocNotify` DO (#2265) is being retired, not revived.
- **Defect A** (viewer-ready re-fetch on first load) — handled by [`2026-06-09-livequery-viewer-ready-refetch-design.md`](2026-06-09-livequery-viewer-ready-refetch-design.md).
