# LoopX flaky-test watch

Use this when a maintainer asks an agent to prepare a read-only triage packet for
a red `compile_test` run that may be a flaky test.

This guide does not replace the policy in [`flaky-tests.md`](flaky-tests.md).
It only turns the repeated human loop into a compact no-send packet before a
maintainer decides whether to rerun, append to #1515, proceed, or open a
deterministic failure issue.

## Authority

- Tracker: [VibesDIY/vibes.diy#1515](https://github.com/VibesDIY/vibes.diy/issues/1515)
- Policy: [`agents/flaky-tests.md`](flaky-tests.md)
- CI source of truth: `common ci run` / `compile_test`
- Test gate notes: [`actions/base/action.yaml`](../actions/base/action.yaml)

## Default boundary

Default mode is read-only and no-send.

Do not:

- comment on #1515;
- rerun CI;
- open an issue;
- open a branch or PR;
- mark a failure as ignorable;
- read private artifacts, credentials, or maintainer-only logs.

Stop and ask the maintainer when a decision needs private artifacts,
authentication, an external write, or a judgment not supported by public
evidence.

## Inputs

Collect only public or maintainer-provided evidence:

- PR number, title, head SHA, and changed files;
- failing workflow run and job name;
- parsed failure summary from the job summary or `test-timing` artifact when
  available;
- same-head rerun result, if already available;
- isolated test command and result, if a maintainer has provided one;
- matching comments in #1515.

## Packet format

```text
PR / run:
Head SHA:
Changed-file relevance:
Failure signature:
Known tracker match:
Same-head rerun status:
Isolation command/result:
Classification:
Recommended maintainer action:
Draft tracker comment, if approved:
Stop condition:
```

## Classification rules

Use the narrowest supported classification:

- `known_flake`: signature already appears in #1515 and same-head rerun or
  isolation evidence supports non-determinism.
- `new_likely_flake`: changed files look unrelated and rerun or isolation
  evidence passed without code changes, but there is no exact tracker match yet.
- `deterministic_failure`: the same failure reproduces across reruns or in
  isolation.
- `harness_failure`: the suite did not produce a valid test report, exited with
  a non-test failure, timed out, or failed before tests actually ran.
- `change_related`: the failure surface matches files or behavior changed by
  the PR.
- `needs_human`: evidence is incomplete or requires maintainer-only access.

## Recommended actions

- For `known_flake` or `new_likely_flake`, recommend a maintainer-approved CI
  rerun or an approved #1515 comment draft.
- For `deterministic_failure`, recommend a separate issue or PR fix, not a #1515
  flake entry.
- For `harness_failure`, do not suppress it as a flake.
- For `change_related` or `needs_human`, ask the maintainer for the missing
  context before proceeding.

## Maintainer local LoopX setup

```bash
loopx doctor
loopx connect \
  --goal-id vibes-diy-flake-watch \
  --objective "Prepare no-send triage packets for VibesDIY flaky-test watch decisions" \
  --domain github_ci_flake_triage \
  --goal-doc agents/flaky-tests.md \
  --adapter-kind read_only_project_map_v0 \
  --adapter-status connected-read-only

loopx todo add \
  --goal-id vibes-diy-flake-watch \
  --role agent \
  --task-class advancement_task \
  --action-kind github_ci_flake_triage \
  --text "Prepare a no-send packet for the latest red compile_test run and stop before any CI rerun, issue comment, branch, or PR."

loopx refresh-state \
  --goal-id vibes-diy-flake-watch \
  --classification initial_flake_watch_connected \
  --delivery-batch-scale single_surface \
  --delivery-outcome outcome_progress
```
