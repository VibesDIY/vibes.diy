# Client-Side Access Helper (`can`) — Design

**Date:** 2026-06-21
**Scope:** Give generated vibe code one canonical, hard-to-misuse way to ask "can the current viewer read / write / delete this?" by running the app's own `access.js` **in the client** as a dry-run, instead of asking authors to re-derive the server's verdict by hand from `viewer` / `isOwner` / `access.hasChannel()` primitives.
**Status:** Drafted, awaiting review (questions for @CharlieHelps at the end)
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
- **A new policy DSL.** We keep imperative `access.js`. No migration of existing apps.
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

```ts
// Mirrors makeHelpers(), backed by whoAmI's materialized grants[dbName].
function makeClientCtx(user, grants) {
  return {
    requireAccess(channelId) {
      if (!user) throw { forbidden: `not in channel: ${channelId}` };
      if (!grants.channels.includes(channelId)) throw { forbidden: `not in channel: ${channelId}` };
    },
    requireRole(roleName) {
      if (!user) throw { forbidden: `not in role: ${roleName}` };
      if (!grants.roles.includes(roleName)) throw { forbidden: `not in role: ${roleName}` };
    },
  };
}
```

Throw messages are copied verbatim from the server so client and server reasons match. **The `ctx` contract is frozen to these two members.** Any access function that touches a `ctx` member the shim doesn't implement, goes `async`, or otherwise can't be evaluated, makes the runner return `{ unknown: true }` (see §4) — never a guess.

### 3. Read (`can.see`) is a different, simpler check

Reads are **not** governed by `access.js`. A doc is visible iff its channels intersect the viewer's grants ([`channel-read-filter.ts`](../../../vibes.diy/api/svc/public/channel-read-filter.ts)):

```ts
can.see(doc) === doc.channels?.some((ch) => grants.channels.includes(ch) || grants.publicChannels.includes(ch));
```

Do **not** route `can.see` through `access.js`. (Owner-bypass-on-read semantics to confirm against the read gate — see open questions.)

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
| signed-in non-owner | owner-only type                    | `owner only`              |
| owner               | owner-only type                    | allowed                   |
| member              | channel type, in channel           | allowed                   |
| non-member          | channel type, not in channel       | `not in channel: X`       |
| signed-in           | role-gated, lacks role             | `not in role: X`          |
| any                 | result with zero channels          | `unreadable write`        |
| any                 | fn using unimplemented `ctx`/async | `unknown` → optimistic    |

Drive both the client shim and the server [`makeHelpers`](../../../vibes.diy/api/svc/public/access-function.ts) path from the same fixtures so they can't silently diverge.

## Rollout

Low install base — innovate forward rather than preserve the primitives:

1. Ship the runner + `can` over today's `grants` (additive; `useViewer` untouched).
2. Repoint the prompts: one gating rule (`can.*` + `reason`), demote raw `viewer`/`isOwner` to identity/display only. (This is the real version of the reverted #2495 wording patch — fix the surface, then the wording is trivial.)
3. Fix the stale `user.userSlug` in `jchris/pickathon-v2` (tiny, unrelated cleanup surfaced by the audit).

## Open questions for review (@CharlieHelps)

1. **Delivery of `access.js` source to the iframe** (§6): inline in `mountParams`, attach to `whoAmI`, or fetch over the bridge post-`runtime.ready`? Which fits the existing caching / hot-swap plumbing best, and how does it interact with the `vibe.evt.viewerChanged` refresh path in [`VibeContext.tsx`](../../../vibes.diy/vibe/runtime/VibeContext.tsx)?
2. **Eval mechanism client-side:** the server isolates `access.js` in QuickJS. Client-side it's the app's own code already in the sandbox — is a plain `new Function` / module eval acceptable, or do we want QuickJS in the iframe too for semantic parity and to keep a misbehaving function from touching the host? (Weight vs. fidelity.)
3. **Frozen `ctx` contract (§2):** OK to hard-freeze to `requireAccess` / `requireRole`, with anything else → `unknown` → optimistic? Or do you foresee a near-term `ctx` member that the client genuinely couldn't satisfy from materialized grants (which would change the fallback rate)?
4. **Read semantics (§3):** confirm the exact `can.see` rule — channel ∩ (grants.channels ∪ publicChannels), and whether the owner has any read bypass the client must mirror.
5. **Reason shape:** pass the raw thrown `forbidden` string through as `reason` (what makes the copy fix work today), or move access functions toward structured `{ forbidden, code }` so the UI can map codes reliably without matching English?
6. **Surface naming / deprecation:** new `useVibe()` returning `{ me, can, ready }`, or graft `can` onto the existing `useViewer()` and keep one hook name? Given the install base, how aggressively do we demote `viewer`/`isOwner`-as-gate in the prompts?
