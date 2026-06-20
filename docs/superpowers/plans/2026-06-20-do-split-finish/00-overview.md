# Finish the AppSessions DO split — plan overview

> **For agentic workers:** REQUIRED SUB-SKILL: subagent-driven-development (recommended) or executing-plans. Each track below is its own PR (or PR chain). Tracks A1→A2→A3 are deploy/verify-ordered. Tracks B and C are design-level here — run `brainstorming` then `writing-plans` to expand each into a full TDD plan before executing.

**Goal:** Close the remaining open items in #2264 and #2265 by finishing the DO
split: retire `AccessFnDO`, add a `SharedSessions` singleton DO, and deprecate
the standalone `/chat/` route.

**Spec:** [../../specs/2026-06-20-do-split-finish-design.md](../../specs/2026-06-20-do-split-finish-design.md)

**Tracking:** #2264 (cleanup remainder), #2265 (deferred items 1–3).

## Before anything: close out what already shipped

Most of #2264 and #2265 §1 (DocNotify) already landed (see spec § "What
already shipped"). The first PR in this effort should:

- Tick the done checkboxes in #2264 (§1–3) and #2265 §1 (DocNotify half).
- Post a status comment on both issues mapping each checkbox to its merged PR.
- Leave the AccessFnDO, SharedSessions, and `/chat/` items open — they are this
  effort's tracks A, B, C.

## The tracks

| Track | File | PR(s) | Status | Closes |
| --- | --- | --- | --- | --- |
| A1 | [01-route-vibe-doc-ops-to-vibeapi.md](01-route-vibe-doc-ops-to-vibeapi.md) | 1 | full TDD plan | — |
| A2 | [02-remove-apphandlers-from-chat-plane.md](02-remove-apphandlers-from-chat-plane.md) | 1 | full TDD plan | — |
| A3 | [03-accessfn-do-class-deletion.md](03-accessfn-do-class-deletion.md) | 1 | full plan (wrangler) | #2265 §1, #2264 §4 |
| B | [04-shared-sessions-do.md](04-shared-sessions-do.md) | chain | design + outline | #2265 §2 |
| C | [05-chat-route-deprecation.md](05-chat-route-deprecation.md) | chain | design + outline | #2265 §3 |

## Dependency order

```
A1 ──> A2 ──> A3        (each its own PR; A3 has a wrangler dry-run gate)
B ───────────> C        (C needs B's lazy ChatSessions)
```

A and B are independent. Land A3 before B starts editing `sharedHandlers` /
ChatSessions to keep connection-role changes isolated.

## Safety invariants (do not violate)

1. **AppSessions / UserNotify cross-script bindings (cli → prod) stay.** They
   are live. Only `ACCESS_FN_DO` (a local binding everywhere) is touched in A3.
2. **Keep every historical migration tag.** Only append (`v7`, then `v8` for
   Track B). wrangler rejects a deploy when a previously-applied tag is missing.
3. **`wrangler deploy --dry-run` per env is the authoritative gate** for any
   wrangler.toml change. If any env errors, stop and apply the documented
   contingency.
4. **No doc-write handler may run on a non-overriding DO once A2 lands** — that
   is the whole point (it is what makes `env.ACCESS_FN_DO` dead). Verify with
   the parity test and a grep gate.

## Done when

- #2264 and #2265 have no open checkboxes (or remaining items are explicitly
  re-scoped into fresh issues).
- `AccessFnDO` class, `ACCESS_FN_DO` bindings, source, and env type are gone;
  all envs deploy clean.
- `SharedSessions` serves page-load queries; ChatSessions is chat-only and lazy.
- `/chat/` redirects to `/vibe/`; chat is inline on the vibe route.
