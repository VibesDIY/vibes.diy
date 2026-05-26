# Git Workflow

Settled team conventions for branching, rebasing, and PR handling in this repo. These are not open to debate — the GitHub repo and CI are configured around them.

## Always check the current branch before acting

Never assume the current branch is the same as before — other agents and the user may have switched branches between turns. Run `git branch --show-current && git status -s` at the start of any task that touches git (commits, pushes, tags, rebases) or edits files. Stale branch assumptions have caused deploying the wrong code in the past. Treat branch awareness like a shell prompt: always know where you are before acting.

## Rebase only — never squash, never merge-commit

Always rebase, never squash or merge-commit. This is a settled decision, not open to technical debate.

- Never suggest squashing.
- Never use `--squash`.
- The GitHub repo is configured to only allow rebase merging.
- If someone asks about merge strategy, the answer is rebase.

Rebase preserves every individual commit and its committer through the whole chain. For long-running projects with collaborative branches, this gives the clearest history.

## Rebase topic branches onto integration branches

Always rebase topic branches onto integration branches (e.g. `mabels/vibes-diy-api`) — never merge into them. Merging creates noise in PR diffs (extra merge commits, unrelated files showing up).

```bash
git fetch origin
# branch from origin/<integration-branch>
git rebase origin/<integration-branch>   # before pushing or creating a PR
```

Never `git merge <integration-branch>` into a topic branch.

## Topic branches are namespaced by the originating human

Topic branches must be named `<github-account>/<topic>` after the human who originated the work — e.g. `jchris/dry-run-prompt-inspection`, `mabels/vibes-diy-api`. The github account prefix tells everyone at a glance who's driving the branch and prevents collisions when multiple humans + agents are pushing topic branches at the same time.

Agents working on jchris's behalf use `jchris/<topic>`. Worktree tools that auto-generate names like `worktree-<topic>` or `issue-<n>-<topic>` are convenient but produce orphan-looking branches in `gh pr list` — rename before the first push, or push under the correct `<account>/<topic>` name from the start.

Existing branches that already shipped under a different name stay as-is (don't churn history to rename). The rule applies to new branches.

## No amend / no force push on shared integration branches

On any shared integration branch, **always create new commits** — never `git commit --amend`, never `git push --force-with-lease`. Amending or force-pushing rewrites history that others may have already pulled. New commits on top are always safe; rewrites are not.

This rule applies to any branch that other people / other agents pull from regularly. Topic branches that are clearly your own can be amended freely until they're pushed for review.

## Review every commit before pushing

Read the full diff of every commit before `git push`. Check each pattern against the [rules-bag](rules-bag.md) — no `instanceof`, no complex stringification chains, no casts, no inline HTML. If something looks like a workaround, it probably is. Ask for guidance or rethink the approach rather than shipping a "cries for help" pattern.

Rules-bag applies to repository-authored code; prompt-generated `App.jsx` is exempt while it remains generated output.

During PR review/remediation of rules-bag findings:

- Auto-fix low-risk violations without asking first.
- Ask clarifying questions before higher-risk fixes (behavior changes, architecture changes, or unclear intent).

PR reviews are fast and reviewers will catch rules-bag violations. Catching them yourself before submission keeps the review loop tight.

## Always open a PR after committing to a topic branch

Any time commits land on a topic branch (i.e. any branch that is not `main` or a shared integration branch), open a pull request immediately after the final commit — don't wait to be asked. The PR is the handoff artifact: it's where the user reviews, deploys from, and decides whether to merge. Leaving commits on a topic branch with no PR means the work is invisible.

Workflow:
1. Commit(s) land on `<account>/<topic>`.
2. `git push -u origin <branch>` (if not already pushed).
3. `gh pr create ...` with title, summary bullets, and a test plan.
4. Return the PR URL to the user.

Skip PR creation only when the user has explicitly said they don't want one yet, or when you're working on a branch that is itself a PR-review branch (e.g. making fixup commits on someone else's branch at their request).

## Ask before merging PRs

Never merge PRs without explicit user confirmation. The workflow is: create PR → tag from PR branch → deploy and validate in prod → then merge only after the user says to.

The user deploys and validates from the PR branch before merging. Merging prematurely bypasses that validation step and can't be easily undone. After creating a PR, ask before running `gh pr merge`. Same rule applies to setting auto-merge — the deploy tag goes on the PR branch commit, not on main.
