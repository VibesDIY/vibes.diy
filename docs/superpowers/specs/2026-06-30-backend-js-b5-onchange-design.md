# Slice B5 — `onChange` after write commit (a new dedicated post-commit queue message) — design

Parent epic: [#2856](https://github.com/VibesDIY/vibes.diy/issues/2856), per-app `backend.js`.
Epic design: [`2026-06-29-per-app-backend-js-design.md`](./2026-06-29-per-app-backend-js-design.md) (§ Slice B5).
Predecessors: **B3** (`BackendDO` + `_api` → isolate + `attemptBackendFetch`), **B4** (the durable timer
lane: `evt-backend-arm` queue poke, `attemptBackendScheduled`, `loadSelectedBackend`).

> **Status: design approved** (Codex P2 ×3 folded in; Charlie signed off all 5 questions — see § _Design
> questions — resolved_). Implementation follows on this branch. Built **dark** behind `BACKEND_JS=off` —
> whole-epic deploy at the end.

## Goal

After a document write **commits**, fire the vibe's `backend.js` `onChange` handler in the per-vibe
isolate, **fire-and-forget**: the write succeeds regardless of whether (or how) `onChange` runs. The
handler receives the changed document, its prior version, and the db name. This is the third trigger
(after `fetch`/B3 and `scheduled`/B4) and the one that closes the loop between a vibe's data and its
server code — but it's also the one that can **feed itself** (a handler write re-triggering `onChange`),
so loop-breaking is in-scope here, not a follow-up.

Non-goals (later slices): real `ctx.db` write-back through access (B6 — in B5 `ctx.db` still throws, so a
handler **cannot** actually write yet), secrets (B7), egress (B8). `onChange` handlers in B5 get the same
B3/B4 `ctx` (`appInfo` baked; `userInfo` is the `null` seam; `db`/`secrets` throw).

## The central decision — a new dedicated message, NOT `evt-doc-changed`

The epic design is emphatic (corrected per a Codex P2 review): **do not reuse
`vibes.diy.evt-doc-changed`** for backend `onChange`. That stream is **local WebSocket fan-out** via
`notifyDocChanged` (`cf-serve.ts`) — it carries **no document content** (only ids/channel), reaches
**only currently-subscribed sockets**, and **duplicates per channel**. Consuming it for `onChange` would
miss handlers when nobody's watching, deliver without the payload the handler needs, and fan out wrong.

So B5 emits a **new, dedicated** queue message — `vibes.diy.evt-backend-onChange` — on the existing
`VIBES_SERVICE` queue, in the **same post-commit step** as the write, carrying the full payload. This
mirrors B4's `evt-backend-arm` exactly: a new `evt-*` type → queue consumer → a handler that pokes
`BackendDO` → the isolate.

### Where it's emitted — **two** commit paths, not one (Codex P2)

Both write paths in `api/svc/public/app-documents-write-eventos.ts` commit via
`allocateAndInsertRevision` and **both** must emit `onChange`:

- **`putDocEvento.handle()`** — create/update. Emit **after** the call returns `alloc.inserted === true`
  (the content-identical no-op at `:527` is correctly skipped, same as the other downstream side effects).
- **`deleteDocEvento.handle()`** — delete. It inserts a **tombstone row** (`data: {}`, `deleted: 1`) via
  the same allocator (shared per-doc lock key, `:806`). Emitting only from `putDoc` would mean **normal
  `deleteDoc` calls never fire `onChange`** — the gap Codex caught. So `deleteDoc` emits too, with a
  delete-shaped payload built from the actual tombstone row.

To keep one emit path, factor a shared `emitBackendOnChange(vctx, { ownerHandle, appSlug, dbName, docId,
seq, deleted, doc, oldDoc, writerUserId, depth })` helper that both handlers call after their commit.

**`oldDoc` must be the committed predecessor, derived under the lock — not the pre-read head (Codex
P2).** The access-fn path reads `headRow?.data` _before_ `allocateAndInsertRevision`, but the allocator
serializes commits in its per-doc critical section. Two concurrent updates can both read head `A`, then
commit `B` and `C`; `onChange` for `C` would then report `oldDoc = A` instead of its true predecessor
`B`. Fix: derive `oldDoc` from the committed `seq - 1` row (the allocator returns the committed `seq`),
i.e. read the predecessor revision **after** the commit, rather than trusting the racy pre-read. (For a
create, there is no `seq - 1` for that docId ⇒ `oldDoc = null`.) Emission is `await vctx.postQueue(...)`
— the same injected helper (`cf-serve.ts`, `env.VIBES_SERVICE.send`) B4's poke uses.

## Components

### 1. The message type (`api/types/settings.ts`)

Arktype, mirroring `evtBackendArm`:

```ts
export const evtBackendOnChange = type({
  type: "'vibes.diy.evt-backend-onChange'",
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string",
  docId: "string",
  seq: "number", // committed revision seq — idempotency key (Codex P2)
  deleted: "boolean", // true ⇒ tombstone (from deleteDoc); false ⇒ create/update
  doc: "unknown",
  "oldDoc?": "unknown | null",
  depth: "number", // loop-guard generation (see §4); user writes emit depth 1
  "writerUserId?": "string | null", // captured at emit; UNUSED in B5 (B6 resolves identity)
});
```

`MsgBase<EvtBackendOnChange>` is the envelope (`tid/src/dst/ttl/payload`), as for `evt-backend-arm`.

### 2. The emit (post-commit, fire-and-forget)

In the post-commit block, **best-effort**:

```ts
// Fire-and-forget: a queue-enqueue failure must never fail the user's write.
await exception2Result(() => vctx.postQueue({ payload: { type: "vibes.diy.evt-backend-onChange", … } satisfies … }));
```

The write has already committed; an enqueue error does **not** fail the write, but it must **not** be
silent (Charlie): log it at `error` **and** emit a counter/metric (`backend_onchange_enqueue_failed`)
so a systemic enqueue outage is observable rather than a quiet stream of dropped `onChange`s. The event
shape is explicit via
the `deleted` flag (sourced from which handler emitted, not guessed from doc contents):
**create** = `deleted:false`, `oldDoc` null; **update** = `deleted:false`, both present;
**delete** = `deleted:true`, `doc` is the tombstone row (`data: {}`) and `oldDoc` the prior committed
document (the `seq - 1` revision). Handlers branch on `deleted` rather than sniffing `doc._deleted`.

### 3. The queue handler (`api/queue/handlers/evt-backend-onChange.ts`)

Same skeleton as `evt-backend-arm`: `validate` via `isEvtBackendOnChange`, then `handle` calls a new
`QueueCtx.invokeOnChange(payload)`. **Failure propagation**, but with a deliberate split (this is the
key handler-policy decision):

- `executor_error` / `handler_error` (transient — DO miss, isolate 5xx) ⇒ **return `Err`** so
  `message.retry()` fires (the worker's `shouldRetryTrigger`, locked in B4).
- `backend_disabled` / `no_onChange_handler` (nothing to run — flag off, or the live release has no
  `onChange` export) ⇒ **return `Ok`** (ack; retrying would never help). Same shape as B4's `no_schedule`.

### 4. Loop-breaking — source-tag **and** depth-cap together (Charlie's requirement)

A backend `ctx.db.put` inside `onChange` can re-enqueue another `onChange` → unbounded amplification.
Per @CharlieHelps, use **both** guards (either alone is insufficient: a tag alone can't stop a
legitimate A→B→A chain; a depth cap alone can't tell a backend-induced write from a user write):

- **Depth (generation) on the message.** A **user** write emits `onChange` at `depth = 1`. When a
  handler at generation _N_ writes (B6), that write is tagged `depth = N`; its commit emits `onChange` at
  `depth = N + 1` — but **only if `N < MAX_ONCHANGE_DEPTH`**. At the cap, the post-commit step **skips
  emission** (and logs the suppression). Proposed `MAX_ONCHANGE_DEPTH = 4`.
- **Source tag on the write.** The depth travels **with the write request** (an internal
  `req.backendOrigin?: { depth }`), set only by B6's `ctx.db.put` and **absent for frontend writes** (⇒
  treated as `depth 0`, so its `onChange` is `depth 1`). The tag is also what lets B6's access gate know
  a write is backend-originated.

**In B5 this guard is built and unit-tested but dormant**: `ctx.db` throws, so no handler can write, so
every emitted message is `depth 1` and no chain ever forms. We still (a) thread `depth` through the
envelope, (b) read `req.backendOrigin?.depth ?? 0` at emit, (c) suppress at the cap — and test the
suppression directly by simulating an incoming write tagged at `MAX_ONCHANGE_DEPTH`. So when B6 turns on
writes, the guard is already proven, not retrofitted.

### 5. `QueueCtx.invokeOnChange` + `BackendDO` op (`onchange`)

- `QueueCtx.invokeOnChange(payload)` addresses `BACKEND_DO.idFromName(backendDoName(owner, slug))` and
  POSTs to the DO with `BACKEND_OP_HEADER: BACKEND_OP_ONCHANGE` (a new constant in `backend-do-addr.ts`),
  the `x-vibe-owner`/`x-vibe-slug` headers, and the `{ dbName, docId, seq, deleted, doc, oldDoc, depth,
writerUserId }` **as the request body** (too big/structured for headers). Returns `Err` on
  non-2xx/throw (→ retry).
- `BackendDO.fetch()` gains a third op branch (after `arm`): `BACKEND_OP_ONCHANGE` → `invokeOnChange()`,
  which `buildVctx(request)` (B4's synthetic-request bootstrap is unnecessary here — `onChange` **has** a
  real incoming request) and calls the new `attemptBackendOnChange(vctx, …)`. **Not single-flighted** —
  `onChange` does not touch `this.ticking`; it runs unblocked alongside `fetch` and the timer lane (B4 §2.4).

### 6. The executor function (`api/svc/intern/attempt-backend-onchange.ts`)

Mirror `attemptBackendScheduled` precisely (shared `loadSelectedBackend`, so `onChange` runs the **same
selected release** `_api`/cron serve):

```ts
export type OnChangeOutcome =
  | { ran: true }
  | { ran: false; reason: "backend_disabled" | "no_onChange_handler" | "executor_error" | "handler_error" };
```

…select executor (off ⇒ `backend_disabled`), `loadSelectedBackend` (no `onChange` in `handlers` ⇒
`no_onChange_handler`), then `executor.invoke({ source, handler: "onChange", trigger: { userHandle: null,
payload: { doc, oldDoc, dbName, docId, seq, deleted } } })`; isolate ≥500 ⇒ `handler_error`. Never throws — a structured
outcome the handler turns into ack-vs-retry. `userHandle: null` is the **B6 seam** (B6 resolves the
writer's identity); `writerUserId` rides the envelope now so B6 needs no emit-site change.

### 7. Wrangler

No new binding work: B4 already cross-script-bound `BACKEND_DO` into `wrangler.queue-consumer.toml`, and
`LOADER`/`BACKEND_JS` already live on the main worker where the DO runs. B5 reuses both.

## Delivery contract

- **At-least-once, no strict ordering** per `(dbName, _id)` at launch (per @CharlieHelps). The queue
  redelivers on a handler `Err`; handlers must be **idempotent**. Document an optional handler-supplied
  **dedupe-key** convention (the `doc._id` + committed `seq` is a natural idempotency key — surface `seq`
  in the payload so handlers can dedupe).
- **The commit→enqueue gap is at-most-once for one crash edge.** If the worker dies _after_ the revision
  commits but _before_ `postQueue` returns, that one `onChange` is lost (no outbox in B5). Accepted at
  launch and documented; an outbox/transactional-enqueue is a future hardening, not a B5 requirement.
- **Delivered with zero subscribed sockets** — the explicit regression guard against the
  `evt-doc-changed` mistake: `onChange` fires off a dedicated queue message, wholly independent of the
  WebSocket fan-out, so a write with no client watching still runs the handler.

## Testing (fake binding/loader, flag off; pure functions where possible)

- **Emit:** a committed `putDoc` (real revision) enqueues exactly one `evt-backend-onChange` with the
  right `{ownerHandle, appSlug, dbName, doc, oldDoc, depth: 1, seq}`; a content-identical no-op
  (`alloc.inserted === false`) enqueues **nothing**.
- **Event shape:** create (`deleted:false`, `oldDoc` null), update (`deleted:false`, both present),
  delete (`deleted:true`, tombstone `doc`, prior `oldDoc`) surface correctly.
- **Delete path emits (Codex regression guard):** a `deleteDoc` commit enqueues an `evt-backend-onChange`
  with `deleted:true` and the prior document as `oldDoc` — not just `putDoc`.
- **`oldDoc` under concurrency (Codex regression guard):** two racing updates to the same docId yield
  `onChange` events whose `oldDoc` is each one's true committed predecessor (`seq - 1`), not a shared
  stale pre-read.
- **Write-succeeds-on-emit-failure:** a `postQueue` that throws does **not** fail the write (the
  fire-and-forget guarantee).
- **Handler dispatch:** `attemptBackendOnChange` runs `handler: "onChange"` against the fake loader and
  returns `ran:true`; off ⇒ `backend_disabled`; no `onChange` export ⇒ `no_onChange_handler`; isolate
  5xx ⇒ `handler_error`.
- **Ack vs retry:** `backend_disabled`/`no_onChange_handler` ⇒ handler returns `Ok` (ack);
  `executor_error`/`handler_error` ⇒ `Err` (retry) — reusing B4's `shouldRetryTrigger` path.
- **Loop guard (dormant but proven):** an emit with simulated `req.backendOrigin.depth = MAX` enqueues
  **nothing**; `depth = MAX-1` enqueues `depth = MAX`; a user write (no origin tag) enqueues `depth = 1`.
- **Zero-socket delivery:** the message is emitted/handled with no subscribed WebSocket (the
  evt-doc-changed regression guard).
- **Release-scope:** `onChange` runs the **production** release's code, not a later dev push (the B3/B4
  release-skew carry-forward, applied to `onChange`).

## Design questions — resolved (Charlie's review)

1. **Loop-guard shape/cap → keep the split as proposed.** `depth` on the `onChange` message +
   `backendOrigin` on internal writes; wire it in **B5 (dormant)** with tests; `MAX_ONCHANGE_DEPTH = 4`
   is a good launch default. (Confirmed.)
2. **onChange via `BackendDO` → keep it on the DO.** Preserves the "backend execution goes through the
   DO" invariant and avoids duplicating `buildVctx`/isolate routing in consumer code. (Confirmed.)
3. **Fire-and-forget, no outbox in B5 → accepted for launch**, with **one requirement**: enqueue failure
   must be **visible** — log + metric, not silent — and the at-most-once commit→enqueue gap stays
   explicit in the spec. (Folded into § _The emit_ and § _Delivery contract_.)
4. **Carry `writerUserId` + `seq` (+ `docId`) now → yes.** Keep `userHandle: null` as the B6 seam, but
   preserve provenance/idempotency fields in B5 so B6 needs no emit-site replumbing. (Confirmed.)
5. ~~**Delete representation.**~~ **Resolved by Codex** (Charlie concurs) — deletes have their own
   `deleteDocEvento` (a tombstone row, not a `_deleted`-flagged `putDoc`), so B5 emits from **both**
   handlers via a shared helper and carries an explicit `deleted` flag (see § _Where it's emitted_).

## Codex review folded in (P2 ×3)

1. **`oldDoc` derived under the lock.** The pre-read `headRow?.data` races the per-doc seq allocator —
   two concurrent updates could give `onChange` the wrong predecessor. Now: derive `oldDoc` from the
   committed `seq - 1` revision after commit, not the racy pre-read.
2. **Delete path.** `deleteDocEvento` (tombstone, `deleted: 1`) is a separate commit path; emitting only
   from `putDoc` would silently never fire `onChange` on deletes. Now: both paths emit via a shared
   `emitBackendOnChange` helper, with an explicit `deleted` flag and the tombstone as `doc`.
3. **`seq` in the envelope.** The delivery contract uses `seq` as the idempotency key and the emit test
   asserts it, but the canonical payload omitted it. Now added to the Arktype type and forwarded through
   the DO/executor body (`docId` too, for addressing the `seq - 1` lookup).
