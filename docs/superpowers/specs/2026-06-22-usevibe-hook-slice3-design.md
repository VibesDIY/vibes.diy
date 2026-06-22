# `useVibe()` hook — client access-helper, slice 3

**Date:** 2026-06-22
**Status:** Approved — ready to split into an implementation plan
**Parent spec:** [`2026-06-21-client-access-helper-design.md`](./2026-06-21-client-access-helper-design.md) (Plan A)
**Builds on:** slice 1 (client `access-runner`, PR #2503), slice 2a (`accessFnSource(cid)` RPC + resolver, PR #2505), slice 2c (source delivery into `VibeContext`, PR #2508)

## Summary

Ship `useVibe(dbName)` — the new canonical gating surface for vibe app code. It answers write questions (`can.create` / `can.edit` / `can.delete`) by running the vibe's own `access.js` in the client against a candidate document, using identity, grants, and `access.js` source that earlier slices already deliver into `VibeContext`. This is the consumer that turns the delivery plumbing into something `App.jsx` actually calls, and the surface slice 4's prompt flip will teach.

The hook is a **pure consumer** of data already on the context — it adds no new RPC, no new wire payload (except a small additive `adminMode` field on `viewerEnv`). It exists so generated code stops re-deriving access logic from `viewer`/`isOwner` and instead asks the same function the server enforces.

## Why

The root-cause bug (garden-gnome/aesthetic-board: a signed-in owner told to "Sign in to compose") came from `App.jsx` hand-rolling a gate off identity instead of asking `access.js`. `useVibe().can` collapses gating to one rule — **gate on `can.*`, render its `reason` as the fallback copy** — so the generated code can't drift from the server's actual decision.

## Public API

```ts
const { me, can, ready } = useVibe(dbName: string);

// me    : { userHandle, displayName?, isOwner } | null   (null = anonymous)
// ready : boolean
// can.create(partialDoc) → { ok: boolean, reason?: string }
// can.edit(doc)          → { ok: boolean, reason?: string }
// can.delete(doc)        → { ok: boolean, reason?: string }
```

- `dbName` is the Fireproof database name. It is both the `accessFnBindings` key (→ `accessFnCid`) and the export-name selector `extractExportSource(source, dbName)` uses to pick the right access function out of a multi-db `access.js`.
- **`can.see` is omitted this slice.** Per-doc stored output channels are not delivered to the client yet; reads are already server-filtered, so held docs are visible by construction. `can.see` lands in a later slice once per-doc output channels are delivered.
- Identity/display (`ViewerTag`, `viewer`, `isOwner` as _display_) stays on `useViewer()`. `useViewer()` is unchanged and stays for back-compat.

### Usage examples

```jsx
// The garden-gnome fix: gate the compose bar on can.create, not on identity.
function PromptBar() {
  const { can } = useVibe("aestheticBoard");
  const v = can.create({ type: "tile" });
  if (!v.ok) return <SignInHint>{v.reason}</SignInHint>; // "authentication required"
  return <ComposeBar />;
}

// Gate the tree on `ready` to avoid a half-resolved flash.
function Comments() {
  const { me, can, ready } = useVibe("comments");
  if (!ready) return <Skeleton />;
  const v = can.create({ type: "comment", authorHandle: me?.userHandle });
  return v.ok ? <CommentBox /> : <Muted>{v.reason}</Muted>;
}

// Per-row edit/delete affordances.
{
  messages.map((m) => (
    <Row key={m._id}>
      {can.edit(m).ok && <EditButton doc={m} />}
      {can.delete(m).ok && <DeleteButton doc={m} />}
    </Row>
  ));
}
```

## Architecture

`useVibe` lives in a new leaf module `vibes.diy/vibe/runtime/use-vibe.ts`, exported from `runtime/index.ts`. It reads `VibeContext` (which already exposes `mountParams` and `accessFnSources` after slice 2c) and composes the slice-1 runner (`evaluateWrite`). No new context, no new bridge call.

```
useVibe(dbName)
  ├─ VibeContext.mountParams.viewerEnv     → me, grants[dbName], adminMode, identityReady
  ├─ VibeContext.mountParams.accessFnBindings → dbName → accessFnCid
  ├─ VibeContext.accessFnSources           → cid → (string | null | absent)
  └─ evaluateWrite({ source, dbName, doc, oldDoc, user, grants, adminMode })  [slice 1]
```

### Data derivation

| Hook value  | Source                                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| `me`        | `viewerEnv.viewer` (`{ userHandle, displayName? }`) + `viewerEnv.isOwner` → `{ userHandle, displayName?, isOwner } \| null` |
| `grants`    | `viewerEnv.grants?.[dbName] ?? { channels: [], publicChannels: [], roles: [] }`                                             |
| `adminMode` | `viewerEnv.adminMode ?? false` (newly threaded — see below)                                                                 |
| `cid`       | `accessFnBindings.find((b) => b.dbName === dbName)?.accessFnCid`                                                            |
| `source`    | `accessFnSources.get(cid)` (string = ready, null = resolved-unknown, absent = pending)                                      |

## Readiness contract

Three input states combine into `ready` and the `can.*` behavior. This is the whole point of slice 2c's three-state cache, plus a grace timeout so a never-arriving source can't strand the app.

- **`identityReady = viewerEnv !== undefined`.** `viewer === null` is _resolved_ (anonymous), still ready. `undefined` is the pending gap behind the original flash bug.
- **`sourceReady`** for the dbName's `cid`:
  - no binding for dbName → no access function → no gate → `sourceReady = true`.
  - `cid → string` → ready, real verdict.
  - `cid → null` (resolved-unknown: host found no source) → ready, **optimistic**. _Interactive, never wait forever._
  - `cid` absent (pending) → not ready **until a grace timeout (`SOURCE_GRACE_MS`, default 4000ms) elapses**, after which the hook degrades to `sourceReady = true` + optimistic. This guards against an RPC failure that leaves the cid absent for the session (slice 2c leaves it absent on transient error). _Interactive, never wait forever._
- **`ready = identityReady && sourceReady`.**

**Grace-timeout state is keyed by `cid`, not purely per-hook-instance (per review).** Two components mounting `useVibe` on the same db must agree on when the source "gives up" — independent per-instance timers could flip them to interactive at slightly different times. The implementation uses a small shared registry keyed by `cid` (module-level alongside `accessFnSources`, or on `VibeContext`): the first hook to observe `cid` pending arms one `setTimeout(SOURCE_GRACE_MS)`; on expiry it records the `cid` as grace-degraded and notifies subscribers, so every hook for that db resolves `sourceReady` together. A `cid` that resolves (string or null) before expiry cancels/voids the timer.

Acceptance criteria for the timer:

- arms **only** while the source is truly pending (`cid` absent from `accessFnSources`); never armed for a resolved (`string`/`null`) or unbound db.
- resets when the hook's `dbName` (hence `cid`) changes.
- cleans up on unmount and survives React StrictMode double-mount without leaking timers or double-degrading.
- a real source arriving after grace-degradation still takes effect (real verdict supersedes the optimistic degrade on the next render).

### `can.*` verdict mapping

`can.create/edit/delete` call `evaluateWrite` and normalize the slice-1 `WriteVerdict` to `{ ok, reason? }`:

| Action               | `evaluateWrite` args                |
| -------------------- | ----------------------------------- |
| `create(partialDoc)` | `doc = partialDoc`, `oldDoc = null` |
| `edit(doc)`          | `doc = doc`, `oldDoc = doc`         |
| `delete(doc)`        | `doc = doc`, `oldDoc = doc`         |

`oldDoc` mirrors `doc` for edit/delete because the production corpus is membership-only (the access function gates on the viewer's channel/role, not the doc delta), so `oldDoc`'s body is irrelevant and `oldDoc = doc` is **exact** for those functions.

**Caveat (per review):** the runner passes `oldDoc` straight through to the invoked function (`invoker(doc, oldDoc, ...)`), so `oldDoc = doc` does _not_ become `unknown` — a **transition-sensitive** policy (one that compares the new doc against its prior version, e.g. "allow edit only if `status` didn't change") would evaluate against `oldDoc === doc` and could return a **concrete but divergent** verdict, not `unknown`. This is an accepted v1 approximation for today's membership-only corpus; it is _not_ a silent-safe fallback. Server enforcement remains authoritative, so a client-side over-allow is still rejected + rolled back at write time. Supplying a real prior-doc (the stored version) to `edit`/`delete` is the follow-up that removes the approximation; `unknown` telemetry would not flag this divergence, so it is called out here explicitly.

Verdict normalization:

| Runner result                 | Condition         | `can.*` returns                                                       |
| ----------------------------- | ----------------- | --------------------------------------------------------------------- |
| not ready                     | `ready === false` | `{ ok: false, reason: "pending" }`                                    |
| `{ ok: true }`                | allowed           | `{ ok: true }`                                                        |
| `{ ok: false, reason, code }` | denied            | `{ ok: false, reason }`                                               |
| `{ unknown: true, reason }`   | uneval­uable      | `{ ok: true, reason }` — **optimistic**, server stays source of truth |

The optimistic-unknown path keeps a stale/old client from ever lying: it renders the surface and defers to the existing optimistic-write + server-rejection + rollback pattern. `0%` of today's corpus hits it.

## adminMode threading (additive)

`adminMode` (the owner-admin-toggle) makes the runner's `requireAccess`/`requireRole` no-op. It is currently passed to the `whoAmI` request but is **not** on the `viewerEnv` that reaches the iframe, so the hook can't see it. Without it, an owner in admin mode who isn't a literal channel member would get a client deny the server would allow — reintroducing the flash-of-wrong-gate the helper exists to kill.

Today `adminMode` rides only on _requests_ (`ReqGetDoc` / `ReqQueryDocs` / `ReqVibeWhoAmI`, sandbox→host) — the client already knows its own toggle via `vibeApp.adminMode`. It is absent from every _inbound_ identity path, so it can be silently dropped on a refresh (admin toggle without reload) unless every producer forwards it. **Explicit propagation checklist (per review) — all four must carry `adminMode` or the toggle desyncs:**

1. **whoAmI response / resolver payload** — add `adminMode` to the whoAmI _response_ (it is currently request-only) so the inbound identity refresh carries it. (The producer also holds it locally via `vibeApp.adminMode`; the response field makes it authoritative end-to-end.)
2. **sandbox bridge passthrough** — the runtime's whoAmI→viewer plumbing forwards `adminMode` rather than discarding it.
3. **runtime bootstrap + `viewerChanged` producers** — both the initial bootstrap viewer and every `vibe.evt.viewerChanged` emitter include `adminMode`. `EvtVibeViewerChanged` (`types/index.ts`) gains `"adminMode?": "boolean"`; `VibeContext`'s handler copies it through (same spread pattern as `isOwner`/`grants`).
4. **render-time `viewerEnv`** — `viewerEnv` type (`vibe.ts`) gains `"adminMode?": "boolean"`; `render-vibe.ts` populates it into the server-rendered `viewerEnv` (it already resolves admin state for the route).

**E2E acceptance criterion:** an owner toggles admin mode and `can.*` verdicts flip **without a reload** (the `viewerChanged` refresh path carries the new `adminMode` and the hook re-evaluates). Non-admin behavior is unchanged (`adminMode` absent/`false`).

## Telemetry

Minimal this slice: a dev-mode `console.warn` when a `can.*` call hits the `unknown` branch, as a seam. Full unknown-rate telemetry (decision #270 in the parent spec) stays a later Plan-A item — it should be a counter/bridge event, out of scope here.

## Testing

Browser tests (real Chromium, `vibes.diy/tests/app/`) for `use-vibe`:

- **owner-allow** — owner + member grants → `can.create().ok === true` (compose bar shows).
- **member-allow** — signed-in channel member → allowed.
- **anon-deny-with-reason** — `me === null`, `requireAccess` fn → `{ ok: false, reason: "authentication required" }` (the garden-gnome case).
- **unknown→optimistic** — async / unimplemented-`ctx` source → `{ ok: true, reason }`.
- **pending→skeleton** — cid absent, within grace window → `ready === false`.
- **grace-timeout→interactive** — cid still absent past `SOURCE_GRACE_MS` → `ready === true`, `can.*` optimistic.
- **shared-grace agreement** — two `useVibe` hooks on the same db flip to interactive together off one shared per-`cid` timer, not two independent ones.
- **timer hygiene** — timer arms only while `cid` is absent, resets on `dbName` change, and a StrictMode double-mount leaks no timers / doesn't double-degrade.
- **no-binding→optimistic** — dbName not in `accessFnBindings` → `ready === true`, `can.*` optimistic.
- **adminMode-bypass** — `viewerEnv.adminMode === true`, non-member owner, `requireAccess` fn → allowed.
- **adminMode flips without reload** — a `vibe.evt.viewerChanged` carrying `adminMode: true` makes a previously-denied `can.*` flip to allowed with no remount (the refresh-path E2E criterion).

Plus a small unit assertion that the verdict normalization maps each `WriteVerdict` variant correctly.

## Scope / non-goals

- **No `can.see`** and no per-doc output-channel delivery (separate slice).
- **No prompt/guidance flip** — that is slice 4. This slice ships the helper dormant-but-callable; nothing teaches it yet, nothing existing breaks.
- **No migration** of the ~197 live vibes (Plan B).
- **No QuickJS-in-iframe** — plain `new Function` eval via the slice-1 runner, parity held by the shared fixture matrix.

## Rollout

Additive and non-destructive. `useVibe` ships alongside the untouched `useViewer`. With nothing teaching it yet (slice 4), there is no behavior change for any existing or newly generated app until the prompt flip — keeping the whole experiment reversible per the parent spec's A→B gate.
