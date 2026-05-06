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

## No amend / no force push on shared integration branches

On any shared integration branch, **always create new commits** — never `git commit --amend`, never `git push --force-with-lease`. Amending or force-pushing rewrites history that others may have already pulled. New commits on top are always safe; rewrites are not.

This rule applies to any branch that other people / other agents pull from regularly. Topic branches that are clearly your own can be amended freely until they're pushed for review.

## Review every commit before pushing

Read the full diff of every commit before `git push`. Check each pattern against the [rules-bag](rules-bag.md) — no `instanceof`, no complex stringification chains, no casts, no inline HTML. If something looks like a workaround, it probably is. Ask for guidance or rethink the approach rather than shipping a "cries for help" pattern.

PR reviews are fast and reviewers will catch rules-bag violations. Catching them yourself before submission keeps the review loop tight.

## Ask before merging PRs

Never merge PRs without explicit user confirmation. The workflow is: create PR → tag from PR branch → deploy and validate in prod → then merge only after the user says to.

The user deploys and validates from the PR branch before merging. Merging prematurely bypasses that validation step and can't be easily undone. After creating a PR, ask before running `gh pr merge`. Same rule applies to setting auto-merge — the deploy tag goes on the PR branch commit, not on main.
