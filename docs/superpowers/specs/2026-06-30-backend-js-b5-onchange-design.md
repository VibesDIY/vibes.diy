# Slice B5 — `onChange` after write commit (a new dedicated post-commit queue message) — design

Parent epic: [#2856](https://github.com/VibesDIY/vibes.diy/issues/2856), per-app `backend.js`.
Epic design: [`2026-06-29-per-app-backend-js-design.md`](./2026-06-29-per-app-backend-js-design.md) (§ Slice B5).
Predecessors: **B3** (`BackendDO` + `_api` → isolate + `attemptBackendFetch`), **B4** (the durable timer
lane: `evt-backend-arm` queue poke, `attemptBackendScheduled`, `loadSelectedBackend`).

> **Status: spec-first.** Design only; implementation follows on the branch after Charlie's feedback.
> Built **dark** behind `BACKEND_JS=off` — whole-epic deploy at the end.

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

### Where it's emitted

`putDocEvento.handle()` (`api/svc/public/app-documents-write-eventos.ts`), **after**
`allocateAndInsertRevision` returns with `alloc.inserted === true` (i.e. a real revision committed — the
content-identical no-op at `:527` is correctly skipped, same as the other downstream side effects). At
that point everything the payload needs is in scope: `req.ownerHandle`, `req.appSlug`, `dbName`,
`req.doc` (new), the prior head data (the `headRow?.data` already loaded upstream for the access fn),
and the writer's `userId`. Emission is `await vctx.postQueue(...)` — the same injected helper
(`cf-serve.ts`, `env.VIBES_SERVICE.send`) that B4's poke uses.

## Components

### 1. The message type (`api/types/settings.ts`)

Arktype, mirroring `evtBackendArm`:

```ts
export const evtBackendOnChange = type({
  type: "'vibes.diy.evt-backend-onChange'",
  ownerHandle: "string",
  appSlug: "string",
  dbName: "string",
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

The write has already committed; we swallow any enqueue error (log only). The event shape derives from
nullness: **create** = `oldDoc` null/absent + `doc` present; **update** = both present; **delete** =
`doc` carries the Fireproof tombstone marker (`_deleted`) with `oldDoc` the prior — the handler reads
`doc._deleted` (the existing write path always inserts `deleted: 0` rows; delete-shaped writes arrive as
docs flagged in their data — confirm in §Open-questions).

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
  the `x-vibe-owner`/`x-vibe-slug` headers, and the `{ dbName, doc, oldDoc, depth, writerUserId }` **as
  the request body** (too big/structured for headers). Returns `Err` on non-2xx/throw (→ retry).
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
payload: { doc, oldDoc, dbName } } })`; isolate ≥500 ⇒ `handler_error`. Never throws — a structured
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
- **Event shape:** create (`oldDoc` null), update (both), delete (`doc._deleted`) surface correctly.
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

## Open questions for Charlie

1. **Loop-guard shape — depth-on-message + tag-on-write, `MAX_ONCHANGE_DEPTH = 4`.** Is the split right
   (generation count rides the `onChange` message; the source-tag/depth rides the **write request** via an
   internal `req.backendOrigin`, absent for frontend writes)? And is building it **dormant** in B5
   (handlers can't write yet) — threaded + unit-tested via a simulated tagged write — the right call,
   versus deferring the wiring to B6 when writes actually exist? Is 4 a sane cap?

2. **onChange via `BackendDO` vs. inline in the queue consumer.** I propose routing through
   `BackendDO.invokeOnChange` (consistent with the epic diagram; reuses `buildVctx` + per-vibe isolate
   addressing + the one "all backend exec goes through the DO" invariant) — **even though** `onChange`
   needs no durable state and no single-flight. The alternative (run `attemptBackendOnChange` directly in
   the consumer) is lighter but forks a second vctx-build path. Keep it on the DO?

3. **Fire-and-forget + the commit→enqueue gap.** Emit best-effort after commit, swallow enqueue errors so
   the user write never fails, and accept the narrow at-most-once edge (worker dies between commit and
   enqueue) — **no outbox in B5**. Acceptable at launch, or do you want a transactional outbox now?

4. **Carry `writerUserId` (+ `seq`) on the envelope now (B6 seam + idempotency).** B5 passes
   `userHandle: null` to the executor but stashes the writer's `userId` and the committed `seq` in the
   message, so B6 resolves identity without touching the emit site and handlers get a natural dedupe key.
   Carry them now, or keep the envelope minimal and re-plumb in B6?

5. **Delete representation.** The existing write path inserts `deleted: 0` rows; delete-shaped writes
   arrive as docs flagged in their data (`_deleted`). Confirm `onChange` should surface deletes as
   `doc` = the tombstone (with `_deleted: true`) + `oldDoc` = prior, rather than `doc: null`.
