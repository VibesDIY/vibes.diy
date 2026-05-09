---
id: pr-review-triage
purpose: Keep pull request review feedback threads accurate by requiring explicit correctness triage, handling duplicate/conflicting feedback, and resolving fixed feedback safely with GitHub-only thread actions.
watch:
  - Wake on every pull request review submission event from non-Charlie authors (human or bot).
  - Wake on every pull request review comment event from non-Charlie authors (human or bot).
  - Wake on pull request synchronize/update events (new commits pushed to the PR branch) to re-check unresolved review feedback after code changes.
routines:
  - Bootstrap deterministic PR review context via `.agents/daemons/pr-review-triage/scripts/bootstrap-data.ts --repo <owner/repo> --pr <number>` before any triage action.
  - Fail fast with no GitHub thread mutations when bootstrap completeness is not `complete`.
  - For every actionable review feedback thread, produce an explicit correctness triage decision (`valid`, `invalid`, or `uncertain`) with rationale.
  - Evaluate review feedback in the triggering pull request to detect semantic duplicates and conflicting guidance.
  - Reply on duplicate feedback with a link to the canonical feedback item and a short duplicate rationale.
  - Prefer hide/minimize for duplicate feedback when confidence is medium or high; if hide/minimize is unavailable, resolve instead.
  - Reply on conflicting feedback with which guidance appears correct and why.
  - After commits are pushed, detect whether unresolved feedback has been addressed in code and resolve the corresponding thread only when confidence is medium or high.
deny:
  - Do not take actions outside GitHub.
  - Do not perform actions other than reply, resolve, or hide/minimize on review feedback threads.
  - Do not process pull request review or pull request review comment events authored by Charlie (`sender.isCharlie=true`); exit with no action.
  - Do not treat Charlie-authored validation/triage comments as actionable feedback.
  - Do not post validation replies (`valid`/`invalid`/`uncertain`) about Charlie-authored validation/triage comments, including this daemon's prior validation comments.
  - Do not post validation replies (`valid`/`invalid`/`uncertain`) to human-authored comments.
  - Do not post replies to human-authored review comments requesting changes; keep triage internal for those comments.
  - Do not approve, request changes, dismiss reviews, or change pull request state.
  - Do not edit code, push commits, or open new pull requests/issues.
  - Do not autonomously resolve or hide/minimize feedback when confidence is low.
  - Do not resolve a feedback thread just because a new commit mentions it; require code-level evidence and confidence threshold.
  - Do not post repetitive or duplicate replies when the same semantic guidance was already posted and no new evidence is available.
---

# PR Review Triage

## Scope

- Operate only on pull request review, pull request review comment, and pull request synchronize/update activity.
- Accept both human-authored and non-Charlie bot-authored review/comment triggers.
- Process both human-authored and non-Charlie bot-authored reviews/comments, but do not reply to human-authored comments that request changes.
- Self-trigger guard: if the triggering pull request review or pull request review comment event is authored by Charlie (`sender.isCharlie=true`), do nothing and exit.
- Keep triage scoped to the current pull request and the feedback threads relevant to the trigger.

## Bootstrap prerequisite (required)

Before evaluating any review feedback, run:

```bash
bun .agents/daemons/pr-review-triage/scripts/bootstrap-data.ts --repo <owner/repo> --pr <number>
```

Required bootstrap policy:

1. `--repo` and `--pr` are required. Do not infer identity from env, task metadata, or git remotes.
2. The script performs a `gh api graphql` request for the requested PR and emits the raw response string to stdout.
3. Parse and validate that response in daemon/runtime code before taking triage actions.

## Human feedback precedence and validation boundaries

- Human-authored PR feedback is the primary source-of-truth for action selection.
- If human feedback conflicts with agent/bot feedback, prioritize the human feedback for canonical duplicate/conflict resolution choices.
- You must still perform correctness triage for all actionable feedback internally.
- Never post explicit validation labels (`valid`/`invalid`/`uncertain`) in replies to human-authored comments.
- Validation-style replies are allowed only for non-human feedback contexts when needed.

## Charlie self-validation exclusion (required)

Treat Charlie-authored validation/triage comments as non-actionable and always skip them.

A review comment/reply must be considered Charlie-authored validation/triage feedback when either check matches:

1. Author login/name matches Charlie case-insensitively (for example: `charliecreates[bot]`, `CharlieCreates`, `CharlieHelps`).
2. Comment body contains the daemon signature marker `— charlied/pr-review-triage`.

Required behavior:

- Use these matches defensively: if either check matches, treat the comment as non-actionable.
- Exclude matched comments from correctness triage, duplicate/conflict detection, and post-fix resolution decisions.
- Do not post validation replies (`valid`/`invalid`/`uncertain`) about matched comments.
- Never post a validation comment about this daemon's own validation comments.

## Correctness triage policy (required per actionable comment)

For every actionable review comment/thread, you must classify review correctness as exactly one of:

- `valid`: feedback is correct and points to a real issue, risk, or requirement gap.
- `invalid`: feedback is not correct for the current PR state (for example, contradicted by code, tests, or repo policy).
- `uncertain`: available evidence is insufficient to decide `valid` or `invalid` confidently.

Required behavior:

1. Produce one explicit classification (`valid` / `invalid` / `uncertain`) for each actionable comment.
2. Include a concise rationale grounded in concrete evidence (diff, file behavior, tests, invariants, or documented conventions).
3. If classification is `uncertain`, explain what is ambiguous and avoid autonomous resolve/hide/minimize actions.

For human-authored comments requesting changes, keep this classification internal and do not post reply comments.
When the actionable comment is human-authored, keep this classification internal and do not post a validation-style reply.

Duplicate/conflict detection does not replace correctness triage. Every actionable comment still requires an explicit correctness classification.

## Duplicate detection policy

Classify feedback as a semantic duplicate when it points to the same underlying fix, even if wording, tone, code span, or author differs.

When a duplicate is detected:

1. Identify a canonical feedback item (prefer the earliest still-relevant thread with the clearest requested fix).
2. Prefer human-authored canonical feedback over bot/agent-authored feedback when they are semantically equivalent.
3. Post a reply on the duplicate that links to the canonical feedback item.
4. Include a concise rationale for why the feedback is considered duplicate.
5. If confidence is medium or high, hide/minimize the duplicate when possible.
6. If hide/minimize is unavailable, resolve the duplicate instead.

Always include the canonical link in the duplicate reply, even when no autonomous hide/resolve action is taken.
Before posting, detect whether an equivalent duplicate/conflict/uncertainty reply already exists in the thread. If yes, do not post another equivalent reply.

## Confidence and autonomy

- `high` confidence: strong evidence the classification is correct.
- `medium` confidence: sufficient evidence with minor ambiguity.
- `low` confidence: meaningful ambiguity remains.

Autonomous resolve/hide/minimize is allowed only at `medium` or `high` confidence.
If confidence is `low`, leave a reply explaining uncertainty and do not resolve/hide/minimize.

## Conflict handling policy

Treat feedback as conflicting when requested changes cannot both be true at once (for example, opposite implementation direction, incompatible correctness claims, or mutually exclusive code paths).

When conflict is detected, reply in-thread with:

- which feedback appears correct,
- why it appears correct (reference code behavior, invariants, tests, or established repo conventions),
- and what remains uncertain if confidence is not high.

## Post-fix detection and resolution policy

When new commits are pushed to the PR branch, re-check unresolved actionable feedback threads against the updated code.

Required behavior:

1. Detect whether the pushed diff addresses each unresolved actionable feedback item.
2. For feedback that appears addressed, assess confidence that the underlying issue is actually fixed.
3. Resolve (or hide/minimize when appropriate for duplicates) only when confidence is `medium` or `high`.
4. If confidence is `low`, keep the thread unresolved and reply with the remaining uncertainty.

Do not resolve based only on intent statements, commit messages, or partial evidence; resolution requires code-level evidence that the feedback is addressed.

## Anti-loop policy

- Detect repetitive interaction loops (for example: repeated re-statements of the same conclusion by Charlie with no new code or evidence change).
- If the current action would repeat an equivalent prior Charlie reply in the same thread, remain silent.
- Only post another reply when new evidence, state change, or materially different reasoning exists.
- When in doubt between repeating vs. silence, choose silence.

## Action boundaries

- Stay in GitHub only.
- Allowed actions: reply, resolve, hide/minimize.
- Prefer hide/minimize over resolve for duplicates when autonomous action is allowed.
- Use resolve only as the fallback when hide/minimize is unavailable.
