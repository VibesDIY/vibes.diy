# Parallel implementer dispatch

The `superpowers:subagent-driven-development` skill's default rule says "never dispatch multiple implementation subagents in parallel." This is a safety default that prevents index-lock races, file-overlap collisions, and stray commits. On well-decomposed plans where tasks touch disjoint files, parallel dispatch is safe and significantly faster.

## When to parallelize

- Two or more pending tasks each have a "Files:" block.
- The file lists do NOT overlap (verify by grep/inspection BEFORE dispatch — don't trust memory).
- Reviewers are always parallel-safe regardless of files (they're read-only).

Real-world example from #1667: T2 touches `cli/`, T3 touches `api/`, T4 touches `schema/`. No overlap, all safe to dispatch concurrently.

## Risks and mitigations

### Git index lock race

Multiple implementers running `git commit` against the same worktree race the `.git/worktrees/<name>/index.lock`. The window is small (~100ms per commit) but not zero — in practice, when three+ agents commit within seconds, one or two will hit the lock.

**Mitigation**: Every implementer prompt MUST include this paragraph:

> If `git commit` hits `fatal: Unable to create '.git/.../index.lock'` or similar lock contention, wait 5s and retry once. If still failing, report DONE_WITH_CONCERNS so the controller can recover.

### Stray commits to main

A subagent operating from the wrong working directory may commit to `main` instead of the worktree branch. This has happened in practice when a subagent's prompt omitted or misremembered the worktree path.

**Mitigations**:

- Every implementer prompt MUST include:
  - "Worktree: `<absolute path>`. NOT `<canonical-path>` (which is `main`)."
  - "Every Bash command starts with `cd <worktree> && ...`."
  - "Before `git commit`, run `git branch --show-current` — must print `<branch-name>`."

If a stray commit lands on main despite these safeguards, recover by:

1. `git -C <worktree> cherry-pick <stray-sha>`
2. `git -C <canonical-path> reset --hard <prior-main-head>`

### File-overlap drift

A task might modify files outside what its "Files:" lists declare (e.g., a refactor that touches an adjacent file). If two parallel tasks both modify the SAME file silently, the second to commit will sweep up the first's edits. These can be non-obvious on review if the drift is small.

**Mitigation**: Each implementer should `git add` ONLY the files it touched, by exact path:

```bash
git add path/to/file1.ts path/to/file2.test.ts
```

Never `git add .` or `git add -A` in parallel-dispatch mode. This surfaces unexpected file touches before commit.

## When NOT to parallelize

- Tasks edit the same file (even on different lines — edits could collide or create unexpected interactions).
- One task depends on another's output (downstream task needs prior commit's symbols or side effects).
- The downstream commit's hash is needed for a review, test reference, or deployment step.
- Task count is > 3 (above ~3 concurrent agents, index-lock races become frequent enough to outweigh speed gains).

In those cases, serialize or stagger.

## Tracking concurrent state

The plan controller (human or agent) should maintain a file-overlap map BEFORE dispatch:

| Task | Files                                        | Status     |
| ---- | -------------------------------------------- | ---------- |
| T2   | cli/index.ts, cli/index.test.ts              | dispatched |
| T3   | api/svc/public/foo.ts, api/tests/foo.test.ts | dispatched |
| T4   | schema/bar.ts                                | dispatched |

Intersect file sets: T2 ∩ T3 = ∅, T2 ∩ T4 = ∅, T3 ∩ T4 = ∅ → safe.

If a task drifts (modifies a file outside its declared list), surface it in the task's completion report so the controller can note it and avoid similar overlaps in future dispatches.

## Example: dispatch prompt boilerplate

```markdown
## Parallel dispatch safety

This task is part of a parallel-dispatch batch (T3 of 4). Verify before committing:

**Worktree**: `/Users/jchris/code/fp/vibes.diy/.claude/worktrees/implement-1667-prompt-compaction`  
(NOT `/Users/jchris/code/fp/vibes.diy`, which is main)

**Files edited by this task** (ONLY these):

- vibes.diy/api/svc/public/prompt-chat-section.ts
- vibes.diy/api/tests/reconstruct-messages.test.ts

**Before committing**:

1. Run `cd <worktree> && git branch --show-current` — must print `implement-1667-prompt-compaction`
2. Run `cd <worktree> && git add vibes.diy/api/svc/public/prompt-chat-section.ts vibes.diy/api/tests/reconstruct-messages.test.ts`
3. If `git commit` hits index lock, wait 5s and retry once. If still failing, report DONE_WITH_CONCERNS.

**Reported files must match declared files.** If you touched other files, list them in your completion report.
```
