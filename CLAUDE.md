# Claude Development Notes

> **Say command style:** [agents/coding-standards.md § Say command timing & style](agents/coding-standards.md) — ultra-terse, single-word opener, spell out abbrevs (`C I`, `A P I`), `PRs` no space.

## Vibes App Development Guide

**NOTE**: For creating individual Vibes (React components), see `notes/vibes-app-jsx.md`. The instructions in that file are for building apps WITH this platform, NOT for working on this repository itself.

## Agent Rules

Team-shared agent instructions live in the [`agents/`](agents/) directory. These files are meant to be actively maintained — update them when rules change, add new files when new patterns emerge, and remove content that's no longer accurate. PRs that change agent behavior should update the relevant agents/ file alongside the code. Before declaring a PR ready, enforce [`agents/rules-bag.md`](agents/rules-bag.md) and run `pnpm run rules-bag:constructors` successfully.

- [rules-bag.md](agents/rules-bag.md) — Fireproof coding rules and patterns
- [code-quality.md](agents/code-quality.md) — Linter rules and how to run tests
- [testing-access-fn.md](agents/testing-access-fn.md) — Test harness patterns for access-fn behavior (channels, grants, fan-out)
- [coding-standards.md](agents/coding-standards.md) — No inline HTML, clickable links, review commits
- [deploy-tags.md](agents/deploy-tags.md) — Tag naming and deploy runbook
- [environments.md](agents/environments.md) — Dev/prod/cli/preview architecture, stable-entry routing
- [iframe-policy.md](agents/iframe-policy.md) — Vibe iframe sandbox/allow tokens, adding a capability, validating a deployed policy on cli
- [vibe-pkg.md](agents/vibe-pkg.md) — Self-hosted package serving via /vibe-pkg/
- [dev-state.md](agents/dev-state.md) — Which caches are safe to delete, and which destroy local dev data
- [flaky-tests.md](agents/flaky-tests.md) — Rerun (or run the suite in isolation) before treating a `pnpm check` failure as real; log to VibesDIY/vibes.diy#1515
- [pr-lifecycle.md](agents/pr-lifecycle.md) — Spec-first workflow, feature-goal PR titles, autonomous feedback handling, ready-to-merge signal

## Team-shared skills

Invokable Claude Code skills live in [`.claude/skills/README.md`](.claude/skills/README.md). Each skill is a directory with `SKILL.md` plus optional `references/`, `assets/`, and `scripts/`. Claude Code looks for them when running in this repo.

- [`qa-pr`](.claude/skills/qa-pr/SKILL.md) — agent-driven QA pass against a PR preview URL

`agents/*.md` (above) documents _how we work_; `.claude/skills/` provides _things we invoke_. See [`.claude/skills/README.md`](.claude/skills/README.md) for the boundary.

## Writing issues

- Lead every issue with a one or two sentence plain-language summary of the problem, before any technical detail, file paths, or repro steps. A teammate triaging the backlog should be able to tell what an issue is without decoding it.

## Quick Reference

- Run checks: `pnpm check` (format + build + test + lint)
- Run tests: `cd vibes.diy/tests && pnpm test`
- Never push to main
- Never manually update version numbers in package.json
- Don't write releases to code until they are shipped (esm.sh caches bad URLs)
- Don't squash, rebase instead
