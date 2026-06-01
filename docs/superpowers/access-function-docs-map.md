# Access Function Feature — Documentation Map

The access function system adds per-document write validation and channel-based read isolation to Firefly (the database/sync layer). A developer writes `/access.js` with named exports per database; the server runs the matching export on every write, using the return value (`AccessDescriptor`) to validate, route to channels, and declare grants that control who can read what.

## Authoritative API Reference

- **[prompts/pkg/llms/fireproof.md](/Users/jchris/code/fp/vibes.diy/prompts/pkg/llms/fireproof.md)** — The canonical Fireproof API guide, shipped in LLM prompts. The `## Access Function (/access.js)` section (added in PR #2100) is the authoritative source for the access function API: function signature, `AccessDescriptor` return type, `ctx.requireAccess`/`ctx.requireRole` helpers, named export convention, and worked examples (workspace chat, anonymous survey, roles via `members` reduce, `oldDoc` patterns). All other docs should align with this file.

## Visual Spec (HTML)

- **[docs/superpowers/specs/2026-05-31-firefly-access-function.html](/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+firefly-access-function-design/docs/superpowers/specs/2026-05-31-firefly-access-function.html)** (PR #2069, branch `worktree-jchris+firefly-access-function-design`) — Rich visual specification with styled document cards, flow diagrams, and color-coded access function rules. Covers the same API as fireproof.md but adds visual representations of channel membership, grant reduce mechanics, and multi-step flows (onboarding/offboarding, invite, revocation). Also includes the runtime architecture section (per-database DO, QuickJS WASM, hydration protocol) that fireproof.md intentionally omits. Includes additional use cases: employee onboarding (roles + singleton grant docs) and survey variants (open vs invite-only, `allowAnonymous`, `grant.public`).

## Agent Rules

- **[agents/fireproof-channels.md](/Users/jchris/code/fp/vibes.diy/agents/fireproof-channels.md)** — Team-shared agent instructions for the channel system. Explains how channels layer on top of existing role-based access control.

## Design Specs (internal architecture)

These live in `docs/superpowers/specs/` and document server-side implementation details not exposed in the API reference.

- **[2026-05-31-firefly-grant-reduce-design.md](/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn/docs/superpowers/specs/2026-05-31-firefly-grant-reduce-design.md)** (worktree `jchris+invoke-access-fn`) — Full grant reduce architecture: per-database DO identity, hydration protocol, incremental reduce with subtract/rebuild, two-pass channel resolution, `ctx` helpers as QuickJS host functions, push-time export parsing, and `AccessFunctionBindings` schema.

- **[2026-05-31-access-fn-outputs-upsert-fix-design.md](/Users/jchris/code/fp/vibes.diy/docs/superpowers/specs/2026-05-31-access-fn-outputs-upsert-fix-design.md)** — Fix for access function output storage: upsert semantics for `AccessFnOutputs` rows.

- **[2026-06-01-backfill-access-fn-outputs-design.md](/Users/jchris/code/fp/vibes.diy/docs/superpowers/specs/2026-06-01-backfill-access-fn-outputs-design.md)** — Backfill strategy for existing documents that predate access function enforcement.

## Implementation Plans

These live in `docs/superpowers/plans/` and track the sequencing of implementation work.

- **[2026-05-31-invoke-access-fn.md](/Users/jchris/code/fp/vibes.diy/docs/superpowers/plans/2026-05-31-invoke-access-fn.md)** — Phase 1: invoke access functions via QuickJS WASM on every write (PR #2089).

- **[2026-05-31-access-fn-outputs-upsert-fix.md](/Users/jchris/code/fp/vibes.diy/docs/superpowers/plans/2026-05-31-access-fn-outputs-upsert-fix.md)** — Fix for output persistence after Phase 1.

- **[2026-06-01-backfill-access-fn-outputs.md](/Users/jchris/code/fp/vibes.diy/docs/superpowers/plans/2026-06-01-backfill-access-fn-outputs.md)** — Backfill existing documents through the access function.

- **[2026-06-01-channel-gated-reads.md](/Users/jchris/code/fp/vibes.diy/docs/superpowers/plans/2026-06-01-channel-gated-reads.md)** — Phase 3: filter query results by channel membership so users only see documents in channels they have access to.

## Implementation (in-progress branches)

- **`jchris+invoke-access-fn`** worktree — Core implementation:
  - [api/types/access-function.ts](/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn/vibes.diy/api/types/access-function.ts) — `AccessDescriptor`, `AccessFunction`, `UserContext` types
  - [api/svc/public/access-function.ts](/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn/vibes.diy/api/svc/public/access-function.ts) — `makeHelpers` factory for `requireAccess`/`requireRole`
  - [pkg/workers/access-fn.ts](/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn/vibes.diy/pkg/workers/access-fn.ts) — Durable Object: QuickJS evaluation, grant reduce, hydration
  - [api/tests/access-fn-unit.test.ts](/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn/vibes.diy/api/tests/access-fn-unit.test.ts) — Unit tests
  - [api/tests/access-fn-invoke.test.ts](/Users/jchris/code/fp/vibes.diy/.claude/worktrees/jchris+invoke-access-fn/vibes.diy/api/tests/access-fn-invoke.test.ts) — Integration tests

## How the docs relate

```
fireproof.md (authoritative API — what developers see)
    │
    ├── firefly-access-function.html (visual spec — same API + runtime architecture)
    │
    ├── fireproof-channels.md (agent rules — how the team works with channels)
    │
    └── design specs (internal architecture — how the server implements it)
         ├── grant-reduce-design.md (DO identity, hydration, reduce mechanics)
         ├── access-fn-outputs-upsert-fix-design.md (output storage fix)
         └── backfill-access-fn-outputs-design.md (retroactive enforcement)
              │
              └── plans (sequenced implementation steps)
                   ├── invoke-access-fn.md (Phase 1: QuickJS eval)
                   ├── access-fn-outputs-upsert-fix.md (output fix)
                   ├── backfill-access-fn-outputs.md (backfill)
                   └── channel-gated-reads.md (Phase 3: read filtering)
```

fireproof.md is the source of truth for the public API. The HTML spec visualizes the same API with richer examples and also covers runtime internals. Design specs document server-side implementation details. If any doc conflicts with fireproof.md on API shape, field names, or conventions, fireproof.md wins.
