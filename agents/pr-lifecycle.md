# PR Lifecycle

How PRs flow from spec to merge. The goal is to minimize cognitive overhead for the human driver — one PR per feature, clear titles, autonomous feedback handling, and an explicit ready-to-merge signal.

## One PR per feature, titled for the goal

A PR title is the final feature or goal, never a phase label. No `spec:`, `plan:`, `wip:`, or `draft:` prefixes. If the work starts with a spec, the PR title is still the feature the spec describes.

- **Good:** `feat: starter stack onramp at /start`
- **Bad:** `spec: starter stack onramp at /start`

Keep the title updated as the work evolves — if scope narrows or the goal shifts, update the PR title to match. The PR list is a human's at-a-glance view of what's in flight; every title should answer "what does this ship?"

When a spec PR graduates to implementation, don't open a second PR. Push implementation commits to the same branch and update the title if needed. One feature = one PR = one place to look.

Narrow exceptions where splitting is better:

- Scope expands into two independently shippable features
- Implementation is blocked on external dependency/approval while spec work can still land
- Risk isolation requires staged rollout ownership

If none of those apply, single-PR is the default.

## Spec-first workflow

1. Write the spec file (in `docs/` or the relevant location).
2. Commit and push to the topic branch.
3. Open (or update) the PR with a feature-goal title.
4. Post a `gh pr comment` mentioning `@CharlieHelps` with specific questions about the spec — what's unclear, what's missing, what trade-offs need a second opinion. Tailor the questions to the change; don't use a generic template.

The spec commit is the first thing that lands on the branch. Implementation follows after feedback.

## Handling reviewer feedback

When @CharlieHelps (or any reviewer) posts feedback:

Rule of thumb: **escalate whenever reviewer disagreement is plausible.**

- **Handle autonomously:** Wording/clarity edits, naming cleanups, obvious edge-case patches, refactors with unchanged behavior. Just do them and push.
- **Escalate to the human:** API/contract changes, user-visible behavior changes, scope shifts, trade-offs (complexity vs speed, strictness vs flexibility). Surface these concisely — state the question and the options, don't dump the full review thread.

The human should only need to weigh in on actual decisions. Everything else is noise that the agent should absorb.

## Ready-to-merge signal

A PR is ready for the human to consider merging when there's a comment at the bottom of the PR thread with this structure:

> **Rollout watch** 🔭
>
> Top things to keep an eye on as this hits prod:
>
> - [risk or opportunity item 1]
> - [risk or opportunity item 2]
> - ...

This comment tells the human: "I've addressed all feedback, the work is complete, and here's what matters during rollout." Items can be risks ("new DO class, watch for cold-start latency") or fun things to watch ("first users will see the new onramp — check analytics for /start traffic").

Don't post this comment until the work is genuinely complete, CI is green, and `pnpm run rules-bag:constructors` passes. This is the merge signal — posting it prematurely defeats its purpose.

When posting the Rollout watch comment, also add the `ready-to-merge` label to the PR. The comment gives humans context; the label makes merge queue triage faster.
