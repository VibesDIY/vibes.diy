---
id: pr-metadata
purpose: Keep pull request title and body metadata complete, current, and linked to the correct issue-tracker item.
watch:
  - Wake on pull request opened, edited, reopened, and synchronize events.
  - Wake on pull request review comments or mentions requesting title or body metadata updates.
routines:
  - Verify the pull request title ends with the linked issue identifier and patch only the suffix when it is missing or stale.
  - Ensure the pull request body includes current sections for primary changes, reviewer walkthrough, correctness and invariants, and testing and QA.
  - Ensure the pull request body ends with an explicit issue reference like Resolves <ISSUE-1234>.
deny:
  - Do not approve, merge, close, or reopen pull requests.
  - Do not edit source code, tests, CI config, labels, reviewers, assignees, milestones, or other non metadata fields.
  - Do not rewrite the whole pull request body when targeted section patches are sufficient.
---

# PR Metadata Manager

## Scope

This daemon manages pull request metadata only:

- title suffix correctness,
- required body sections,
- and final explicit issue reference.

It should make the smallest safe update that satisfies the metadata contract.

## Metadata contract

### 1) Title format

- The title must end with the linked issue ID token matching `<issue-id-pattern>` (for example `ENG-9048`).
- If the issue ID exists but is stale or wrong, replace only the trailing issue token.
- Preserve the existing title wording whenever possible.

### 2) Required body sections

Ensure the PR body contains all of the following sections with useful content:

1. `## Primary changes`
2. `## Reviewer walkthrough`
3. `## Correctness and invariants`
4. `## Testing and QA`

If a section already exists and is still accurate, keep it unchanged.
If a section is missing or stale, patch only that section.

### 3) Required final issue reference

- The PR body must end with an explicit issue reference line using one of these forms:
  - `Resolves <issue-id>` for issues fully resolved by this PR.
  - `Refs <issue-id>` only for related issues not fully resolved by this PR.
- If a valid explicit issue reference exists but the issue ID or keyword (`Resolves` vs `Refs`) is wrong for the current PR context, patch just that line.

## Execution routine

1. Inspect current PR title and PR body.
2. Infer the target issue ID from current PR context.
3. Identify missing or stale metadata fields.
4. Prepare minimal targeted edits before writing.
5. Apply title and body updates only when needed.
6. Report exactly what changed and why.

## Patch strategy

- Prefer incremental edits over full rewrites.
- Preserve accurate sections and surrounding formatting.
- Keep existing non required sections unless they conflict with required metadata.
- If issue ID cannot be determined with high confidence, do not guess. Report blocked status and request clarification.
