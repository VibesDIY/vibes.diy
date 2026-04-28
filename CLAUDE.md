# Claude Development Notes

## Vibes App Development Guide

**NOTE**: For creating individual Vibes (React components), see `notes/vibes-app-jsx.md`. The instructions in that file are for building apps WITH this platform, NOT for working on this repository itself.

## Agent Rules

Team-shared agent instructions live in the [`agents/`](agents/) directory. These files are meant to be actively maintained — update them when rules change, add new files when new patterns emerge, and remove content that's no longer accurate. PRs that change agent behavior should update the relevant agents/ file alongside the code.

- [rules-bag.md](agents/rules-bag.md) — Fireproof coding rules and patterns
- [code-quality.md](agents/code-quality.md) — Linter rules and how to run tests
- [coding-standards.md](agents/coding-standards.md) — No inline HTML, clickable links, review commits
- [deploy-tags.md](agents/deploy-tags.md) — Tag naming and deploy runbook
- [environments.md](agents/environments.md) — Dev/prod/cli/preview architecture, stable-entry routing
- [vibe-pkg.md](agents/vibe-pkg.md) — Self-hosted package serving via /vibe-pkg/
- [dev-state.md](agents/dev-state.md) — Which caches are safe to delete, and which destroy local dev data
- [flaky-tests.md](agents/flaky-tests.md) — Rerun before treating a `pnpm check` failure as real; log to VibesDIY/vibes.diy#1515

## Quick Reference

- Run checks: `pnpm check` (format + build + test + lint)
- Run tests: `cd vibes.diy/tests && pnpm test`
- Never push to main
- Never manually update version numbers in package.json
- Don't write releases to code until they are shipped (esm.sh caches bad URLs)
- Don't squash, rebase instead
