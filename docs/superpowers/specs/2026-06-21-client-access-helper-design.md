# Client-Side Access Helper (`can`) — Design

**Date:** 2026-06-21
**Scope:** Give generated vibe code one canonical, hard-to-misuse way to ask "can the current viewer read / write / delete this?" by running the app's own `access.js` **in the client** as a dry-run, instead of asking authors to re-derive the server's verdict by hand from `viewer` / `isOwner` / `access.hasChannel()` primitives.
**Status:** Reviewed — all six open questions resolved (see Decisions); ready to split into Plan A (implement helper) + Plan B (migration & retirement)
**Related:** [`2026-05-09-vibe-viewer-identity-capabilities-design.md`](./2026-05-09-vibe-viewer-identity-capabilities-design.md) (the surface this supersedes the gating half of), VibesDIY/vibes.diy#2495 (the prompt-wording patch this replaces)

## Problem

A signed-in user — the **owner** — opened [garden-gnome/aesthetic-board](https://vibes.diy/vibe/garden-gnome/aesthetic-board) and was told "Sign in to compose a board." They were already signed in. The generated `App.jsx` shipped a `PromptBar` that hardcoded the signed-out copy and never branched on identity.

That looks like one bad generation, but it is a **surface problem**, and the surface is how we got the old stuff:

- The system prompt says, verbatim, **"Gate write surfaces on `viewer`"** ([`prompts/pkg/system-prompt.md`](../../../prompts/pkg/system-prompt.md), [`use-viewer.md`](../../../prompts/pkg/llms/use-viewer.md)).
- `access.js` for that app gates writes on `user.isOwner`, not on `viewer`.
- So the prompt's own rule is the **wrong gate** for owner-only apps. Following the guidance produces an app that tells the signed-in owner to sign in.

The deeper issue: `useViewer()` exposes **primitives you must correctly combine** — `viewer` (signed in?), `isOwner`, plus `access.hasRole()` / `access.hasChannel()` from a _second_ hook — and the correct combination is whatever `access.js` happens to do on the server. The UI re-implements the server's policy by hand, in a different vocabulary, from a different import. It drifts. No amount of prompt wording fixes a surface whose easy path is wrong; it only moves the failure rate around.

## Key insight & feasibility evidence

`access.js` is **already the single source of truth** — it just runs server-side. The fix is to stop re-deriving it and instead **run the same function in the client** against a candidate document, with a client `ctx` backed by data we already ship.

This is only viable if access functions' verdicts are a pure function of data the client already holds after `whoAmI`. We measured the live corpus (prod, read-only):

- **197 deployments / 182 distinct `access.js` sources.** Near 1:1 — apps have bespoke functions; there is no small set of shapes to enumerate, so _running the real function_ is the only approach that scales.
- **100% client-evaluable.** AST classification put 181/182 sources (196/197 deployments) in "verdict depends only on `doc` / `oldDoc` / `user.{userHandle,isOwner}` / channel-role membership." The lone outlier reads a stale `user.userSlug` (a rename leftover in our own test app) — and the _server's_ `user` also lacks `userSlug`, so client and server agree anyway.
- **The `ctx` surface is exactly two members:** `ctx.requireAccess` (17 call sites) and `ctx.requireRole` (11). No other `ctx` member, no computed access, no `async`/`await`, no `fetch`, no nondeterminism anywhere in the corpus.

Both `requireAccess` and `requireRole` are membership checks, and `whoAmI` already ships the **materialized** membership the server itself resolves: [`who-am-i.ts`](../../../vibes.diy/api/svc/public/who-am-i.ts) returns `grants[dbName] = { channels, publicChannels, roles }`, which is the reduced output of the same grant graph [`makeHelpers`](../../../vibes.diy/api/svc/public/access-function.ts) walks. So the client shim is exact, not approximate.

## Goals

- One capability surface generated code reaches for: `can.create(doc)`, `can.edit(doc)`, `can.delete(doc)`, `can.see(doc)` — each returning a verdict **and a reason**.
- The verdict comes from the app's real `access.js`, so it cannot drift from server enforcement for the common case.
- The **reason** carries the right fallback copy, so a signed-in owner is never told to "Sign in".
- Collapse two hooks / three vocabularies into one. Make the wrong gate (`viewer` for an owner-only app) hard to even express.
- Forward-compatible: a future `access.js` that does something the client can't replicate degrades to "ask the server" (optimistic write + rollback), never to a confident wrong answer.

## Non-goals

- **Replacing server enforcement.** The server stays the only authority. The client `can` is a UX predictor; every write still authorizes server-side. A wrong client verdict is a cosmetic bug, never a security hole.
- **A new policy DSL.** We keep imperative `access.js` — no migration of the access model. (Migrating existing vibes' _client gating code_ off the old primitives and retiring the old surface is in scope, but as a sequenced **follow-up** — see "Follow-up" below.)
- **Live grant push.** `can` reads the same cached `grants` as everything else; staleness between an owner editing an ACL and the viewer remounting is pre-existing and unchanged (see [prior spec Non-goals](./2026-05-09-vibe-viewer-identity-capabilities-design.md)).
- **Removing `ViewerTag` / identity.** Identity rendering is unchanged; this spec only rationalizes _gating_.

## Design

### 1. Run `access.js` as a client dry-run

The verdict for a write is **not** "did `access.js` throw." The server wraps the function ([`access-function.ts`](../../../vibes.diy/api/svc/public/access-function.ts)); to stay faithful the client must replicate the wrapper:

1. Resolve the named export for the database's binding and call `fn(probeDoc, oldDoc, user, ctxShim)`.
2. If it throws `{ forbidden: msg }` → `{ ok: false, reason: msg }`.
3. Else apply **`enforceAllowAnonymous`**: if `user === null` and the returned descriptor lacks `allowAnonymous: true` → `{ ok: false, reason: "authentication required" }`. (A naïve "didn't throw → allowed" check gets anonymous writes wrong.)
4. Else apply **`isReadableResult`**: if the descriptor has zero channels → `{ ok: false, reason: "unreadable write" }`.
5. Else → `{ ok: true }`.

### 2. The `ctx` shim (frozen contract)

**Parity caveat — mirror the QuickJS write path, not `makeHelpers`.** There are three copies of these helpers in the tree and they **disagree on the anonymous message**: `makeHelpers` in [`access-function.ts`](../../../vibes.diy/api/svc/public/access-function.ts) throws `not in channel: X` for an anon caller, but the **production write path** — the QuickJS host functions in [`cf-serve.ts`](../../../vibes.diy/api/svc/cf-serve.ts#L282) and [`workers/access-fn.ts`](../../../vibes.diy/pkg/workers/access-fn.ts#L107) — returns **`authentication required`** for anon (before any membership check) and **no-ops entirely when `adminMode` is set**. The client shim must mirror the QuickJS path, because that is what actually enforces writes:

```ts
// Mirrors the QuickJS ctx (cf-serve.ts / workers/access-fn.ts), backed by
// whoAmI's materialized grants[dbName] plus the viewer's adminMode flag.
function makeClientCtx(user, grants, adminMode) {
  return {
    requireAccess(channelId) {
      if (adminMode) return; // admin bypass — matches server
      if (!user) throw { forbidden: "authentication required" }; // anon FIRST, before membership
      if (!grants.channels.includes(channelId)) throw { forbidden: `not in channel: ${channelId}` };
    },
    requireRole(roleName) {
      if (adminMode) return;
      if (!user) throw { forbidden: "authentication required" };
      if (!grants.roles.includes(roleName)) throw { forbidden: `not in role: ${roleName}` };
    },
  };
}
```

`adminMode` is already known to the viewer payload (the route passes it through `whoAmI`); the shim needs it as a third input. Throw messages are copied verbatim from the QuickJS helpers so client and server reasons match. **The `ctx` contract is frozen to these two members.** Any access function that touches a `ctx` member the shim doesn't implement, goes `async`, or otherwise can't be evaluated, makes the runner return `{ unknown: true }` (see §4) — never a guess.

> **Cleanup surfaced:** three diverging copies of `requireAccess`/`requireRole` is a latent bug regardless of this feature — the non-QuickJS `makeHelpers` would report the wrong anon reason if any path uses it. Worth collapsing to one shared implementation that both the server eval and the client shim import, which would also make parity structural rather than test-enforced. Filed as a follow-up cleanup.

### 3. Read (`can.see`) uses the stored access-fn output, not the doc body

Reads are **not** governed by re-running `access.js`, and — critically — **a doc's channels are not a field on the doc**. The access function _assigns_ channels at write time; the server stores them in `accessFnOutputs` and the read gate intersects those **stored output channels** (keyed by `docId`) with the viewer's effective ∪ public channels ([`channel-read-filter.ts`](../../../vibes.diy/api/svc/public/channel-read-filter.ts), [`app-documents-read-eventos.ts`](../../../vibes.diy/api/svc/public/app-documents-read-eventos.ts#L176)). A doc with no stored output channels is invisible (`return false`), and there's an `adminOverride` bypass.

So the naïve `doc.channels?.some(...)` is **wrong** — `doc.channels` is almost always `undefined` (channels live in the access output, not the doc body), and any user-authored `channels` property could disagree with the server. The client cannot recompute the channels by re-running the access function either: they were assigned with the **author's** user context at write time, which a different viewer can't reproduce (e.g. a private `user:${author}` channel). The correct shape:

```ts
// outputChannels: Map<docId, string[]> — the stored access-fn output channels,
// delivered to the client alongside the docs (see open question on delivery).
function canSee(doc, outputChannels, grants, adminOverride) {
  if (adminOverride) return true;
  const channels = outputChannels.get(doc._id);
  if (!channels) return false;
  return channels.some((ch) => grants.channels.includes(ch) || grants.publicChannels.includes(ch));
}
```

**Open design tension:** reads are _already_ server-filtered — the client only receives docs it may see — so `can.see` is largely redundant in v1, and shipping per-doc output channels to the client adds wire cost. Options: (a) drop `can.see` from v1 and lean on the fact that held docs are visible by construction; (b) ship the stored output channels only where a finer client-side predicate is actually needed. Flagged in open questions.

### 4. `unknown` → optimistic fallback

When the runner returns `{ unknown: true }`, `can.*` resolves to "allow, but you're on your own": render the surface and rely on the existing **optimistic-write + server-rejection + rollback** pattern the prompt already mandates. 0% of today's corpus hits this path; it is the seatbelt for source #198 (a function that adds `async` or a new `ctx` member). An old client never lies — it defers to the server.

### 5. Pending is first-class

While `isViewerPending` (identity not yet resolved — the exact gap behind the original flash bug), every `can.*` returns `{ ok: false, reason: "pending" }` and the hook exposes `ready`. Authors gate the tree on `ready` (or render skeletons); they cannot accidentally read a half-resolved verdict.

### 6. Delivery of `access.js` to the sandbox

The function currently runs server-side only (QuickJS in [`cf-serve.ts`](../../../vibes.diy/api/svc/cf-serve.ts) / [`workers/access-fn.ts`](../../../vibes.diy/pkg/workers/access-fn.ts)) and never reaches the iframe. The dry-run needs its **source** (plus the export name per `dbName` binding) in the sandbox. Candidate paths (open question): inline in `mountParams` at render, attach to the `whoAmI` response, or fetch over the bridge after `runtime.ready`. The runtime already evaluates `App.jsx`, so the eval machinery exists.

### 7. Public surface

One hook, capabilities with reasons, identity unchanged:

```ts
const { me, can, ready, ViewerTag } = useVibe("aestheticBoard");
// me        → { userHandle, displayName, isOwner } | null
// ready     → boolean (false while identity pending)
// can.create(partialDoc) / can.edit(doc) / can.delete(doc) → { ok, reason? }
// can.see(doc) → boolean
```

`useViewer` stays for back-compat and identity, but the prompt stops teaching `viewer`/`isOwner` as gates — gating guidance collapses to a single rule: **"gate on `can.*`; render its `reason` as the fallback copy."**

## Usage examples

### A. Owner-only board (the bug that started this)

```jsx
function PromptBar({ can, database }) {
  const v = can.create({ type: "tile" });
  if (!v.ok) return <p className="muted">{v.reason}</p>; // "owner only" — never "Sign in" to the owner
  return <ComposeForm database={database} />;
}
```

`access.js` throws `{ forbidden: "owner only" }` for a signed-in non-owner, `{ forbidden: "sign in" }` for anon, and returns normally for the owner. Three correct verdicts and three correct messages, from the one authority — the failure mode is structurally gone.

### B. Any signed-in user (comments)

```jsx
const { me, can, ready } = useVibe("comments");
if (!ready) return <Skeleton />;
const v = can.create({ type: "comment", authorHandle: me?.userHandle });
return (
  <>
    <CommentList />
    {v.ok ? <CommentForm /> : <p className="muted">{v.reason}</p>}
  </>
);
```

### C. Channel-gated messages

```jsx
const v = can.create({ type: "message", channelId, authorHandle: me?.userHandle });
// access.js calls ctx.requireAccess(doc.channelId); shim checks grants.channels →
// reason "not in channel: engineering" when the viewer isn't a member.
{
  v.ok ? <Composer channelId={channelId} /> : <JoinPrompt reason={v.reason} />;
}
```

### D. Per-row edit/delete affordances

```jsx
{
  messages.map((m) => (
    <Row key={m._id} msg={m}>
      {can.edit(m).ok && <EditButton doc={m} />}
      {can.delete(m).ok && <DeleteButton doc={m} />}
    </Row>
  ));
}
```

### E. Read/visibility

```jsx
// Hide a section the viewer can't see, without faking server logic.
{
  can.see(pinnedDoc) && <Pinned doc={pinnedDoc} />;
}
```

### F. Reason → copy mapping (optional polish)

```jsx
const COPY = {
  "sign in": "Sign in to post",
  "owner only": "Only the curator can edit this board",
  "authentication required": "Sign in to continue",
};
const v = can.create(draft);
{
  !v.ok && <p>{COPY[v.reason] ?? v.reason}</p>;
}
```

## Parity test matrix

For each of a sample of real deployed `access.js` files, assert **client runner verdict === server verdict** across the cells:

| user                | doc shape                          | expectation               |
| ------------------- | ---------------------------------- | ------------------------- |
| anon                | type with `allowAnonymous`         | allowed                   |
| anon                | type without `allowAnonymous`      | `authentication required` |
| anon                | channel type (calls requireAccess) | `authentication required` |
| signed-in non-owner | owner-only type                    | `owner only`              |
| owner               | owner-only type                    | allowed                   |
| member              | channel type, in channel           | allowed                   |
| non-member          | channel type, not in channel       | `not in channel: X`       |
| signed-in           | role-gated, lacks role             | `not in role: X`          |
| `adminMode` viewer  | any gated type                     | allowed (bypass)          |
| any                 | result with zero channels          | `unreadable write`        |
| any                 | fn using unimplemented `ctx`/async | `unknown` → optimistic    |
| reader (member)     | `can.see` over stored output chans | matches read gate         |

Drive the client shim and the **production QuickJS path** ([`cf-serve.ts`](../../../vibes.diy/api/svc/cf-serve.ts#L282) / [`workers/access-fn.ts`](../../../vibes.diy/pkg/workers/access-fn.ts#L107)) from the same fixtures so they can't silently diverge — and include a fixture that pins the anon reason (`authentication required`, not `not in channel`) so the three-copies divergence can't regress parity.

## Rollout

Low install base — innovate forward rather than preserve the primitives:

1. Ship the runner + `can` over today's `grants` (additive; `useViewer` untouched).
2. Repoint the prompts: one gating rule (`can.*` + `reason`), demote raw `viewer`/`isOwner` to identity/display only. (This is the real version of the reverted #2495 wording patch — fix the surface, then the wording is trivial.)
3. Fix the stale `user.userSlug` in `jchris/pickathon-v2` (tiny, unrelated cleanup surfaced by the audit).

Steps 1–3 are this spec. Retiring the old surface and migrating the 197 live vibes is a deliberate next phase, scoped below.

## Follow-up (separate effort): retire the old gating surface & migrate existing vibes

Decision: we are willing to **retire** the old gating primitives and **migrate** existing vibes rather than carry both surfaces forever — the install base is small enough to innovate forward. This is split into its own plan so the core helper can ship and bake first; the helper is additive and non-breaking on its own, so this phase carries all the breakage risk and deserves its own review.

Scope of the follow-up:

- **Define "retired".** `useViewer().viewer` / `isOwner` remain for **identity/display** (`ViewerTag`, attribution), but stop being a documented **gate**. `useViewer().can(action, dbName)` (the app-level-ACL checker) and `useFireproof().access.hasRole()/.hasChannel()` as gating calls are superseded by `can.*`. Decide whether superseded members are removed, soft-deprecated (warn in dev), or frozen.
- **Migrate the 197 live vibes.** Two viable mechanisms, to be chosen in the plan:
  - _Codemod_ — AST-rewrite `App.jsx`: replace `!viewer && …` / `isOwner ? … :` / `access.hasChannel(x)` gating branches with `can.create/edit/delete/see` calls. Fast, but each app's gating intent must be inferred from its `access.js`, and the audit shows bespoke functions — so the codemod needs the same dry-run runner to know what each gate _should_ be.
  - _Regeneration_ — re-run codegen for each vibe against the new prompt. Higher fidelity to intent, but re-generates more than gating and needs per-app diffing/QA.
  - Likely: codemod for the mechanical 90%, flag the residue for regeneration.
- **Safety net makes this low-risk.** Because the server stays authoritative and writes are optimistic-with-rollback, a mis-migrated gate is a cosmetic regression caught by the existing rejection path, not data loss. Still: snapshot each app's pre/post gating behavior across the §parity matrix before/after.
- **Sequencing & rollback.** Ship helper (additive) → repoint prompt → migrate in batches behind a per-app flag, owner-only/test apps first (`jchris/*`) → verify → widen. Keep the old surface importable until the migration batch completes, then remove.
- **Done = old gating surface removed from `use-vibes` exports + prompt docs, all live vibes pass the parity snapshot on `can.*`.**

This follow-up gets its own plan doc under [`docs/superpowers/plans/`](../plans/). The mechanism is now decided (hybrid codemod-first + regeneration-residue — see Decisions), so the plan is unblocked.

## Decisions (locked in review — 2026-06-21)

All six open questions were resolved in review. Recorded here as the contract the implementation + migration plans build against:

1. **Delivery of `access.js` into the iframe** → **bridge delivery after `runtime.ready`**, with replay on reconnect. Put an `accessFnCid`/hash in mount params; the runtime requests source only when it's missing or changed. Keeps `vibe.evt.viewerChanged` focused on grants refresh, not code transfer; reuses the existing ready/ack + source-replay plumbing. (Not bundled into `whoAmI`.)
2. **Client eval mechanism** → **plain JS eval in the iframe** for v1 (compile the extracted export via `new Function` / module eval) with the frozen helpers. No QuickJS-in-iframe — it's substantial weight for little gain on the app's own already-sandboxed, sync, deterministic code. Parity held by running one shared fixture matrix against **both** the server runner and the client runner.
3. **Frozen `ctx`** → freeze to `requireAccess` / `requireRole`. Unknown `ctx` usage → `unknown` → optimistic (server remains source of truth). **Add telemetry on `unknown`** so we can detect if new `ctx` members start appearing in generated functions.
4. **Read semantics (`can.see`)** → intersection model as corrected in §3: `true` on admin override, else non-empty `stored-output-channels ∩ (effective grant channels ∪ publicChannels)`. **No owner read bypass** — owner maps to `editor`, not `override`, so the owner gets no special read path the client must mirror.
5. **Reason shape** → adopt a forward-compatible **`{ forbidden, code? }`** now. Keep passing the raw `forbidden` text through as `reason` for copy compatibility, and add a stable `code` as the taxonomy firms up. The runner returns `{ ok, reason, code? }`.
6. **Surface + migration** → **`useVibe()` is the new canonical gating surface** (`{ me, can, ready }`); `useViewer()` stays for back-compat + identity. Migration is **hybrid**: codemod the deterministic patterns first (the majority), regenerate only the ambiguous/outlier apps. Sequencing: ship the additive helper + parity tests → phased migration batches → retire the old gating guidance/surface.

### Resulting splits

- **Plan A — implement the helper** (this spec): runner + `useVibe().can` + bridge delivery + parity fixture matrix + `unknown` telemetry. Additive, non-breaking.
- **Plan B — migration & retirement** (the Follow-up): hybrid codemod/regeneration over the 197 vibes, phased batches with rollback, then remove the old gating surface. Charlie offered to draft this as a plan doc with phases, success metrics, and rollback criteria.
