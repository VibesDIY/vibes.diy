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

| File | Role |
|------|------|
| `vibes.diy/vibe/runtime/use-firefly.ts` | `useFireproof(name, { acl? })` hook — entry point |
| `vibes.diy/vibe/runtime/firefly-database.ts` | `FireflyDatabase` class, `applyAcl()` |
| `vibes.diy/api/svc/public/app-documents.ts` | Server write gate at `putDocEvento` line ~154 |
| `vibes.diy/api/svc/public/db-acl-resolver.ts` | `resolveDbAcl()`, `aclAllows()` |
| `vibes.diy/api/types/db-acls.ts` | `DbAcl` type |
| `vibes.diy/vibe/types/index.ts` | WebSocket message types (`ReqPutDoc`, etc.) |

The write gate in `putDocEvento` currently calls `aclAllows(acl, "write", access)` — this is where the access function evaluation needs to happen **after** the coarse ACL check passes.

## Critical Design Question — Function Serialization

The access function is a JavaScript closure (`(doc, oldDoc, user, ctx) => AccessDescriptor`). It must run **server-side** to be a meaningful security boundary (client-side evaluation defeats the model). Before writing any code, investigate and decide:

1. **String serialization + server eval** — `fn.toString()` on the client, send to server, `new Function(...)` in a restricted Worker context. Simplest. Research whether Cloudflare Workers allow `eval`/`new Function`.
2. **Server-side registration** — access functions are defined in the app's Worker code (not in the vibe component). The vibe just names which function to use. More secure, requires a new registration mechanism.
3. **Client-side pre-evaluation** — run the function on the client, send the `AccessDescriptor` result to the server, server trusts it. Only useful as a prototype / for non-security-sensitive routing.

Pick the approach that is both implementable and honest about its security properties. Document the choice clearly in a comment in the code.

## Implementation Scope (do these in order, stop at the first blocker)

### Phase 1 — Type layer (no behavior change)

1. Add `AccessDescriptor` and `AccessFunction` types:

```typescript
// in vibes.diy/pkg/types/src/ or vibes.diy/vibe/types/
interface Helpers {
  requireAccess(channelId: string): void  // throws if user not in channel
  requireRole(roleName: string): void     // throws if user not in role
}

interface AccessDescriptor {
  channels?:      string[]
  members?:       Record<string, string[]>            // roleName → userSlug[]
  grant?: {
    users?:  Record<string, string[]>                 // userSlug → channelId[]
    roles?:  Record<string, string[]>                 // roleName → channelId[]
    public?: string[]
  }
  expiry?:        string | number | null
  allowAnonymous?: boolean
}

type AccessFunction = (
  doc: unknown,
  oldDoc: unknown,
  user: { userSlug: string; [k: string]: unknown } | null,
  ctx: Helpers
) => AccessDescriptor
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
- A test that writes with `user: { userSlug: "alice" }` and no `allowAnonymous` → expect success (non-null user is unaffected)

## What NOT to do

- Do not remove or change the existing `acl: DbAcl` system — it stays
- Do not implement channel routing or grant reduction in this PR
- Do not pass security-sensitive access functions to the client for evaluation without documenting that it is not a security boundary
- Do not use `eval()` in production code without a comment explaining the security model and constraints
