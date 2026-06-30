# Slice B6 — write-back-through-access as the trigger identity — design

Parent epic: [#2856](https://github.com/VibesDIY/vibes.diy/issues/2856), per-app `backend.js`.
Epic design: [`2026-06-29-per-app-backend-js-design.md`](./2026-06-29-per-app-backend-js-design.md) (§ Slice B6).
Predecessors: **B3** (`_api`→DO→isolate), **B4** (`scheduled` timer), **B5** (`onChange` post-commit +
the dormant loop-guard + the `userInfo: null`/`originDepth: 0` seams this slice fills).

> **Status: design approved** (Codex put/delete split folded in; Charlie signed off all 5 questions + 2
> implementation watch-outs — see § _Design questions — resolved_). Implementation follows on this branch.
> Built **dark** behind `BACKEND_JS=off`. **Risky slice** (write/access path) — merge dormant to `main`,
> hold the actual deploy for a human.

## Goal

Make a backend handler's `ctx.db.put(doc)` / `ctx.db.delete(id)` **real** — routed through the **exact
production write paths the frontend uses**, acting as the **trigger's identity** (`onChange`→original
writer, `fetch`→session user, `scheduled`→owner). Today `ctx.db` throws (the B1–B5 seam); B6 wires it.
This also turns B5's dormant loop-guard **live** (a handler write now carries a trusted generation depth)
and fills every `userInfo: null` seam.

**Put and delete are different gates (Codex) — B6 must NOT conflate them.** `putDocEvento` runs the full
access-fn gate (`localInvokeAccessFn` → grant-state reduce → fail-closed → `AccessFnOutputs` upsert);
`deleteDocEvento` does **not** call `invokeAccessFn` or rebuild grant state — it runs the ACL/DM checks and
**removes** the stored `AccessFnOutputs` row via the tombstone sidecar. A backend write must reuse
**whichever** of the two paths matches the op, so backend allow/deny + sidecar behavior is identical to
frontend writes.

Non-goals: secrets (B7), real egress (B8). Reuse the production access invoker **unchanged** — do **not**
introduce a second enforcement path.

## The central decision — how `ctx.db` reaches the production gate

`ctx.db.put` runs **inside the Worker Loader isolate**; the gate runs **on the host** (the DO / api-svc).
The isolate must call **out** to the host. Three structural choices:

1. **Dedicated host binding passed into the isolate `env`** (proposed). The host hands the loaded isolate
   a `Fetcher`-shaped capability (e.g. `env.__VIBES_DB`); the generated `ctx.db.put` does
   `env.__VIBES_DB.fetch("https://db.internal/put", { body: { doc } })`. The host side routes that to a
   new internal `putDoc`/`deleteDoc` entry **as the trigger identity + trusted depth**. Keeps db ops
   **separate from general egress** (so B6 does not depend on B8's `globalOutbound` proxy), and the
   capability is unforgeable from handler code (it's a host binding, not a URL the handler can reach via
   normal `fetch`, which stays `globalOutbound: null` until B8).
2. **Via `globalOutbound`** — route the isolate's `fetch` through a host Fetcher that special-cases db
   URLs. Rejected: couples B6 to B8's egress knob and mixes db callbacks with user egress.
3. **Return-value DSL** — the handler returns a list of writes the host applies after the handler
   finishes. Rejected: breaks read-after-write within a handler and diverges from the `ctx.db` API shape.

**Proposed: option 1.** Confirm the Worker Loader supports passing a service-binding/Fetcher into a
dynamically-loaded isolate's `env` (open question 1).

## The server entry — reuse the two paths, don't fork them

The host db-callback must call the **same** sequence the matching frontend path runs
(`app-documents-write-eventos.ts`), not a copy — **one path per op**:

- **`put`** → extract `putDocEvento`'s gate (load access binding → fail-closed invoker check →
  `resolveActiveHandle` → load access.js by CID → build grant-state reduce from stored `AccessFnOutputs` →
  `localInvokeAccessFn` → enforce anonymous/zero-channel contracts → **upsert** `AccessFnOutputs` inside the
  seq critical section) into a reusable function both `putDocEvento` and the backend put-callback call.
- **`delete`** → extract `deleteDocEvento`'s path (ACL/DM checks → tombstone insert → **remove** the stored
  `AccessFnOutputs` row via the delete sidecar). **No** `invokeAccessFn`, no grant-state rebuild — matching
  the frontend delete exactly (Codex). Backend deletes must not accidentally run the put gate.

Both extractions give one shared function per op, so backend and frontend writes provably share behavior.
Identity differences (same for both ops):

| Trigger     | `user` passed to the gate                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `onChange`  | `resolveActiveHandle(vctx, writerUserId)` — the **original writer** (carried on the B5 queue envelope) |
| `fetch`     | the **session user** extracted from the `_api` request auth (fills `resolveBackendUserHandle`)         |
| `scheduled` | the vibe **owner** (already the case)                                                                  |

`{ as: "handle" }` impersonation override is **owner-code-only**, enforced host-side (not from handler
input). Grant-state, `oldDoc` (the committed predecessor, server-read — never handler-supplied), and the
sidecar upsert are **server-computed**; the handler never supplies them.

## Loop-guard goes live

A handler write inside an `onChange` at generation _N_ must emit its `onChange` at _N+1_, suppressed past
`MAX_ONCHANGE_DEPTH` (B5). B6 threads the **trusted** depth: the onChange invocation carries its
generation (from the queue envelope's `depth`) into the isolate's `ctx`; `ctx.db.put` forwards it to the
host db-callback as `originDepth`; the host passes it to `emitBackendOnChange` (replacing B5's hardcoded
`0`). The depth is **never** read from handler/client input — it rides the same trusted internal channel
as identity. B5's policy + the suppression test already exist; B6 just feeds them real values.

## Backfill / cold grant-state discipline (put path)

Mirror the frontend **put** path exactly: build grant-state from stored `AccessFnOutputs`; pass an empty
seed only when no outputs exist (cold/backfill), live grants otherwise; always pass the real `oldDoc`;
always upsert the output sidecar inside the seq critical section. A backend put must never widen or hide
access by skipping the sidecar (the epic's explicit B6 requirement). The **delete** path doesn't rebuild
grant-state — it removes the sidecar row — so this discipline applies to puts only.

## Codex review folded in

**Put and delete are different gates.** The first draft described `ctx.db.delete` as flowing through
`localInvokeAccessFn` + grant-state + an `AccessFnOutputs` upsert. Verified against
`app-documents-write-eventos.ts`: only `putDocEvento` calls `invokeAccessFn` (`:249/:257/:338`);
`deleteDocEvento` (`:710+`) runs ACL/DM checks and **removes** the output row, with no access-fn
invocation. The spec now splits the two and points backend deletes at the existing tombstone/output-removal
path, so backend allow/deny + sidecar behavior matches the frontend per-op.

## Design questions — resolved (Charlie's review)

1. **RPC channel → dedicated host callback binding in the isolate `env` (confirmed).** Right shape; keep
   `globalOutbound: null` until B8. Implementation note: the loader wiring today only exposes
   `globalOutbound`, so **B6 needs a small loader extension to pass `WorkerCode.env` bindings** into the
   dynamically-loaded isolate. Dynamic Workers **do** support service bindings in `env`, so use that —
   not a signed-internal-URL transport — unless we hit an implementation blocker.
2. **`ctx.db.put` async + read-after-write → confirmed.** Keep it async; the Promise resolves **only
   after the write path commits** (same semantics as the existing gate). Defer any batched/transactional
   API until there's a concrete multi-write atomicity need.
3. **Concurrent handler + user writes → confirmed, no special ordering layer** — **provided** the backend
   callback writes go through the **same per-doc seq/allocator path** as frontend writes (preserving the
   existing single-writer-per-doc serialization). This is a hard requirement on the implementation.
4. **Gate extraction → per-op shared functions (confirmed).** Extract the `put` gate and the `delete`
   gate **separately** (they're intentionally different — put runs access-fn + outputs-sidecar upsert;
   delete runs ACL/DM + output-row removal); a thinner generic core would be riskier.
5. **`fetch` identity → extract the `_api` session user in B6 now** (not `fetch`→null). And in the same
   pass, **finish the onChange identity/depth plumbing end-to-end**: the writer + depth are already
   carried on the B5 queue envelope but are currently **dropped before handler invoke** — B6 wires them
   through so all three triggers land with consistent identity/depth behavior.

### Implementation watch-outs (Charlie — bake into the build)

- **Isolate cache keying must include the binding shape.** If the per-vibe isolate id / cache key ignores
  the `env`-binding schema, an `env`-binding change could **reuse a stale isolate**. Add a version/hash of
  the binding schema to the isolate cache key so a schema change forces a fresh isolate.
- **The callback capability must be unforgeable from handler code** — exposed **only** through `ctx.db`,
  never reachable via general `fetch` (which stays `globalOutbound: null`). Same trust-boundary discipline
  as B5's `x-backend-op` strip.
