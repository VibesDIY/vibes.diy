# Running the autoresearch outer loop autonomously

The vendored [`autoresearch`](../.claude/skills/autoresearch/SKILL.md) skill drives
an **inner loop** — _modify → commit → verify → keep/discard → repeat_ — inside a
single Claude Code session. This runbook is the **outer loop**: how to run that
unattended so it keeps improving toward a goal across the ephemeral cloud
sessions this repo runs in.

Provenance, what was vendored, and the repo-wide hook scope live in
[`autoresearch-vendor/`](../.claude/skills/autoresearch-vendor/README.md).

## TL;DR

1. Define a goal with a **mechanical success predicate** (exact command +
   expected output). Use `/autoresearch:plan` to derive one.
2. Start the loop on a **dedicated branch**, bounded or `Iterations: unlimited`.
3. Make sure each iteration **commits and pushes** — in a cloud container,
   anything not pushed is lost when the container is reclaimed.
4. Let it open/update a **PR** as its result surface (doubles as your
   notification).
5. To resume after a session ends, re-launch pointing at the same branch; the
   loop reads the committed `orchestrator-state.json` / `handoff.json`.

## 1. Define the goal + success predicate

The loop is only as autonomous as its stop condition is mechanical. Vague goals
("make it better") never terminate; measurable ones do.

> **Fill this in — the metric is yours to name.** Replace the placeholder with
> the concrete predicate you want the loop to drive toward.

```
Goal:    <plain-language goal>
Metric:  <scalar, lower- or higher-is-better>
Verify:  <exact shell command>      # e.g. `pnpm check`
Success: <command exits 0 / metric crosses threshold / N failures -> 0>
```

Worked example (code-health flavour — swap in your own):

```
Goal:    Drive the workspace to a clean check.
Metric:  count of failing checks (lower-is-better)
Verify:  pnpm check
Success: `pnpm check` exits 0
```

Let `/autoresearch:plan "<goal>"` generate and validate this block before a long
run — it catches an un-runnable predicate up front instead of mid-loop.

## 2. Launch

From a session in a clone of this repo, on a dedicated branch (never `main`):

```
/autoresearch "<goal>" Metric: <…> Verify: <…> Iterations: unlimited
```

- Omit `Iterations: unlimited` to stay bounded (the safe default).
- Plain-language goal with no `Metric:`/`Verify:` → orchestrator mode
  (`orchestrate.sh` classifies the goal and routes hops).
- Add `--dry-run` first to print the derived config + planned pipeline without
  executing.

## 3. Persist state every iteration (the part that makes it survive)

Cloud sessions are **ephemeral** — reclaimed on inactivity. The inner loop
already commits each kept change before verifying, but commits only survive if
the branch is **pushed**. For a multi-session outer loop, ensure each cycle:

- commits the code change (loop does this), **and `git push`es the branch**;
- commits the loop's own state so a later session can resume:
  - `autoresearch/<subcommand>-<YYMMDD>-<HHMM>/` — per-run logs + `*-results.tsv`
  - `handoff.json` — chain handoff between subcommands
  - `orchestrator-state.json` — orchestrator progress / units-remaining

If you don't want this state tracked long-term, push it to the working branch
only and squash it out before merge — but it **must** be pushed during the run
or resume is impossible.

## 4. Guardrails (already in place)

- **Never `main`.** Run on a feature branch; let the loop open a PR. The repo
  rule and the skill invariant agree: no push/publish/deploy to shared targets
  without explicit approval.
- **Safety hooks** (committed in [`.claude/settings.json`](../.claude/settings.json)):
  `dangerous-cmd-block` (force-push/destructive bash) and `privacy-block`
  (credential-file reads). Both fail open. They fire on every session in the
  repo. Disable per-run with `AR_DISABLE_DANGEROUS_CMD_BLOCK=1` /
  `AR_DISABLE_PRIVACY_BLOCK=1` only if you understand the consequence.
- **Ship gate.** `/autoresearch:ship` requires explicit approval; `--auto` only
  skips the gate for opening a Code PR, never for release/publish/tag/deploy.

## 5. Resume after a session ends

Start a fresh session on the same branch and re-invoke `/autoresearch` with the
same goal. The loop reads the committed `orchestrator-state.json` /
`handoff.json` and continues from the last recorded hop rather than restarting.
If those files weren't pushed, it starts over from baseline.

## 6. True unattended scheduling (not set up here)

This runbook covers a human-kicked long session. For a loop that **relaunches
itself** with no human — wakes, runs, pushes, sleeps — you need a driver this
repo does not yet have:

- a **scheduled GitHub Action** (or a Claude-Code-on-the-web cron trigger) that
  invokes `/autoresearch` against a checked-in goal config on a cadence;
- branch + state persistence per cycle (section 3);
- a notification path (the PR it opens, or a scheduled check-in).

That driver is a deliberate follow-up — ask for it (`use a workflow` /
"build the scheduled driver") when you want to cross from "long session" to
"runs while you sleep." Budget note: an unbounded loop consumes tokens
continuously; bound it (`--max-cycles N`, a metric threshold, or a CI-cost
ceiling) for any unattended run.
