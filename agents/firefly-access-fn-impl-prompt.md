# Agent Prompt: Implement Firefly Access Function Runtime

## Goal

Wire up the per-doc access function described in the Firefly spec into the vibes.diy runtime. The spec is the source of truth. This is a greenfield implementation of a new capability — the existing `acl: DbAcl` system (role-group based) continues to operate in parallel; the access function is additive.

## Source of Truth

Read this file first — it is the complete spec:

```
vibes.diy/docs/superpowers/specs/2026-05-31-firefly-access-function.html
```

Open it in a browser or read the raw HTML. Everything about the API shape, behavior, examples, and edge cases is defined there. The key sections are:

- **Type definition block** — `Helpers`, `AccessDescriptor` with all fields
- **Anonymous writes require explicit opt-in** — the `allowAnonymous` enforcement rule
- **Workplace chat example** — reference implementation showing real usage
- **Survey app example** — shows `allowAnonymous: true` and `grant.public`

## Current Architecture (read before touching code)

The current system uses a **coarse role-group ACL** (`members | editors | submitters | readers`), not a per-doc function. Key files:

| File                                          | Role                                              |
| --------------------------------------------- | ------------------------------------------------- |
| `vibes.diy/vibe/runtime/use-firefly.ts`       | `useFireproof(name, { acl? })` hook — entry point |
| `vibes.diy/vibe/runtime/firefly-database.ts`  | `FireflyDatabase` class, `applyAcl()`             |
| `vibes.diy/api/svc/public/app-documents.ts`   | Server write gate at `putDocEvento` line ~154     |
| `vibes.diy/api/svc/public/db-acl-resolver.ts` | `resolveDbAcl()`, `aclAllows()`                   |
| `vibes.diy/api/types/db-acls.ts`              | `DbAcl` type                                      |
| `vibes.diy/vibe/types/index.ts`               | WebSocket message types (`ReqPutDoc`, etc.)       |

The write gate in `putDocEvento` currently calls `aclAllows(acl, "write", access)` — this is where the access function evaluation needs to happen **after** the coarse ACL check passes.

## Function Serialization — as built

> **Note (2026-06): this was the original kickoff prompt; the feature shipped.**
> The runtime evolved past the CID-keyed-DO design described in early drafts.
> The current topology is below; for the live DO architecture see
> `agents/do-session-split.md`, and for source resolution see
> `vibes.diy/api/svc/public/access-fn-source.ts`.

**`access.js` file in the vibe filesystem, evaluated in-process via QuickJS WASM on the live Durable Object.**

The access function lives in a dedicated `access.js` file alongside `App.jsx` in the vibe's multi-file filesystem. It is not serialized from a client-side closure — it is stored as source text, content-addressed by CID.

**Evaluation path:**

1. `putDoc` handler looks up the current `access.js` CID for the target database (D1 query).
2. Calls the running DO's local `invokeAccessFn` — eval is **in-process** on whichever DO serves the write (AppSessions, or ChatSessions for app-create backfill); both supply a `localInvokeAccessFn` override (`cf-serve.ts`). There is **no separate access-fn Durable Object** — the dedicated `AccessFnDO` was retired in #2265 (see `do-session-split.md`).
3. Loads `access.js` source from storage by CID and evaluates it in **QuickJS (WASM)** — `getQuickJSWASMModule()` cached per DO instance (lazy init), with a fresh `QuickJS.newContext()` per eval.
4. The WASM module stays cached on the instance; subsequent evals reuse it (re-fetching source only when the CID changes).
5. A doc bound to an access fn with no invoker available **fails closed** rather than writing unchecked (`app-documents-write-eventos.ts`).

**Security model:** eval runs **inside the QuickJS WASM sandbox** — a JS-level VM isolated from the Worker runtime — so developer-authored policy code cannot touch host globals. `unsafe_eval` is **not** required and is **not** set (`compatibility_flags = ["nodejs_compat"]`); there is no worker-level `new Function()`/`eval()` on this path. Do **not** add `unsafe_eval` or reintroduce a CID-keyed access-fn DO.

The interface `(doc, oldDoc, user) → AccessDescriptor | forbidden` is stable. See spec section "Runtime Architecture — Function Serialization" for the original design rationale.

## Implementation Scope (do these in order, stop at the first blocker)

### Phase 1 — Type layer (no behavior change)

1. Add `AccessDescriptor` and `AccessFunction` types:

```typescript
// in vibes.diy/pkg/types/src/ or vibes.diy/vibe/types/
interface Helpers {
  requireAccess(channelId: string): void; // throws if user not in channel
  requireRole(roleName: string): void; // throws if user not in role
}

interface AccessDescriptor {
  channels?: string[];
  members?: Record<string, string[]>; // roleName → userHandle[]
  grant?: {
    users?: Record<string, string[]>; // userHandle → channelId[]
    roles?: Record<string, string[]>; // roleName → channelId[]
    public?: string[];
  };
  expiry?: string | number | null;
  allowAnonymous?: boolean;
}

type AccessFunction = (
  doc: unknown,
  oldDoc: unknown,
  user: { userHandle: string; [k: string]: unknown } | null,
  ctx: Helpers
) => AccessDescriptor;
```

2. Add `access?: AccessFunction` to the `useFireproof` config type alongside (not replacing) `acl`.

3. Add it to `getOrCreateDb` and `FireflyDatabase` constructor — store it but don't wire it yet.

### Phase 2 — `allowAnonymous` enforcement (first real behavior)

This is the most important and most contained feature from the spec: **if `user` is null and the access function returns without `allowAnonymous: true`, reject the write**.

In `putDocEvento` (`app-documents.ts`), after the coarse ACL check passes:

- If the request user is unauthenticated (null user) AND an access function is configured for this db:
  - Evaluate the access function with `(doc, null, null, ctx)`
  - If the result lacks `allowAnonymous: true`, send `{ forbidden: "authentication required" }` and return
  - If it returns `allowAnonymous: true`, allow the write through

The `Helpers` implementation for server-side evaluation should have `requireAccess` and `requireRole` that throw `{ forbidden: "..." }` immediately.

### Phase 3 — Channel routing (deferred)

The `channels` field in `AccessDescriptor` determines which Firefly channels receive the doc on sync. This requires changes to the sync/subscription system and is a separate, larger task. Do not implement this in the same PR.

### Phase 4 — Grant reduction (deferred)

The `grant.{users,roles,public}` and `members` fields build a materialized per-user channel access view. This is also a separate, larger task.

## Working in this Repo

- Always use a git worktree: `superpowers:using-git-worktrees`
- Branch naming: `jchris/firefly-access-fn-runtime` (use the `jchris` namespace)
- Run checks: `pnpm check` (format + build + test + lint) — run from repo root
- Never push to main; open a PR when Phase 1 + Phase 2 are complete and passing
- Run `npx prettier --write` on changed files before committing
- Use TDD: write a test asserting the `allowAnonymous` rejection before implementing it

## Tests

Look for existing test infrastructure in `vibes.diy/pkg/test/` — use `createVibeDiyTestCtx`. Write at minimum:

- A test that writes with `user: null` and access function returning `{}` → expect `forbidden` error
- A test that writes with `user: null` and access function returning `{ allowAnonymous: true }` → expect success
- A test that writes with `user: { userHandle: "alice" }` and no `allowAnonymous` → expect success (non-null user is unaffected)

## What NOT to do

- Do not remove or change the existing `acl: DbAcl` system — it stays
- Do not implement channel routing or grant reduction in this PR
- Do not pass security-sensitive access functions to the client for evaluation without documenting that it is not a security boundary
- Do not use `eval()` in production code without a comment explaining the security model and constraints
