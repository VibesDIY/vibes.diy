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

## What was deliberately NOT vendored

- **Hooks** (`.claude/hooks/autoresearch/`) — the upstream ships 9 safety hooks
  (`dangerous-cmd-block`, `privacy-block`, `session-init`, etc.). They are
  **excluded** to avoid conflicting with this repo's existing `settings.json`
  hook configuration. The skill/commands degrade gracefully without them: the
  only references to "hooks" that remain are git-hook **status values**
  (e.g. `hook-blocked`), not couplings to the upstream hook scripts. If the
  safety hooks are wanted later, reconcile them with the repo's hook setup as a
  separate change.
- The OpenCode (`.opencode/`), Codex (`.agents/`), plugin-marketplace, install
  scripts, docs, and test scaffolding from upstream — not relevant to a
  project-scoped Claude Code skill.

## Upstream safety invariant worth knowing

The skill is bounded by default and, per its own invariants, **never pushes,
publishes, or deploys without explicit user approval**. That aligns with this
repo's "never push to main" / PR-first rules.
