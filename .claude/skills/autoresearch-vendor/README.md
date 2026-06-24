# Vendored autoresearch skill

The [`autoresearch`](../autoresearch/SKILL.md) skill and its `/autoresearch`
command suite are vendored into this repo under `.claude/` so they are available
to sessions that run inside a clone of `vibes.diy` — including **cloud sessions**,
which read `.claude/skills/` and `.claude/commands/` from the repo but have no
globally-installed plugins (the upstream install path,
`npx skills add uditgoenka/autoresearch`, would not persist in an ephemeral
container).

`autoresearch` is an autonomous goal-directed iteration framework: you set a
GOAL, it runs a **modify → verify → keep/discard → repeat** loop against a
measurable metric, automatically keeping improvements and reverting regressions.

This directory (`autoresearch-vendor/`) holds only provenance and the upstream
license. It contains no `SKILL.md`, so it is **not** discovered as a skill.

## Source

- Upstream: <https://github.com/uditgoenka/autoresearch> (Udit Goenka, MIT)
- Vendored version: **2.2.1**
- License: see [`LICENSE`](LICENSE) in this directory.

## What was vendored

- `.claude/skills/autoresearch/` — the router skill (`SKILL.md`) plus its
  `references/` (orchestrator routing, predict personas, reason judge protocol,
  security checklist).
- `.claude/commands/autoresearch.md` and `.claude/commands/autoresearch/` — the
  bare `/autoresearch` router plus the 13 subcommands (`plan`, `debug`, `fix`,
  `security`, `ship`, `scenario`, `predict`, `learn`, `reason`, `probe`,
  `improve`, `evals`, `regression`).
- `.claude/skills/autoresearch/scripts/` — the deterministic helper scripts the
  skill/commands actually invoke: `orchestrate.sh` (orchestrator seam —
  `classify`, `next-hop`, `units`, `plateau`, …) and `score-regression.sh`
  (regression verdict). Upstream references these as repo-root `scripts/*.sh`;
  vendored here under the skill and the in-doc references repointed to the
  skill-local path so they resolve in a fresh/cloud clone without colliding with
  this repo's own top-level `scripts/`.
- **Two safety hooks** — `.claude/skills/autoresearch/hooks/dangerous-cmd-block.cjs`
  (blocks force-push / hard-destructive bash; normal `git push` allowed) and
  `privacy-block.cjs` (blocks reads of credential files unless the path is
  prefixed `APPROVED:`), plus their shared `lib/ar-hook-utils.cjs` and
  `node-hook-runner.sh`. Wired as `PreToolUse` hooks in
  [`.claude/settings.json`](../../settings.json). Both **fail open** — a hook
  malfunction never blocks legitimate work.

## Repo-wide hook scope (important)

Upstream scopes its hooks to autoresearch runs via the **plugin** mechanism
(`CLAUDE_PLUGIN_ROOT`). Vendored as a **project skill**, there is no per-skill
hook scoping: the two hooks in `.claude/settings.json` fire on **every** Claude
Code session in a clone of this repo, not only during `/autoresearch` runs. That
is the intended trade — they are deliberately the two low-false-positive,
fail-open _safety_ guards, and nothing else. Each can be disabled with an env
var (`AR_DISABLE_DANGEROUS_CMD_BLOCK=1`, `AR_DISABLE_PRIVACY_BLOCK=1`).

## What was deliberately NOT vendored

- **The other 7 upstream hooks** — `scout-block`, `simplify-gate`,
  `session-init`, `iteration-context`, `subagent-context`, `dev-rules-reminder`,
  `stop-notify`. These are autoresearch-loop-specific (context injectors,
  notifications) or opinionated (`simplify-gate` blocks "ship" verbs past a LOC
  threshold) and would be noise or friction if applied repo-wide to ordinary
  sessions. Only the two deterministic _safety_ guards above were brought over.
  The remaining surface (e.g. `.ckignore`-driven `scout-block`) has **no
  deterministic guard** in this vendored setup — high-risk operations rely on
  Claude's judgement plus the repo's existing PR/push protections.
- The OpenCode (`.opencode/`), Codex (`.agents/`), plugin-marketplace, install
  scripts, docs, and test scaffolding from upstream — not relevant to a
  project-scoped Claude Code skill.

## Upstream safety invariant worth knowing

The skill is bounded by default and, per its own invariants, **never pushes,
publishes, or deploys without explicit user approval**. That aligns with this
repo's "never push to main" / PR-first rules.
