# PR #1086 — Unresolved Review Comments

Cross-referenced 83 review comments on 2026-03-10. Resolved 78 threads. 5 remain open on GitHub:

## sthis context pattern (Meno preference)

- **skills.ts** — `runSkills` takes only `CliOutput`, not an sthis-like context object
- **bin.ts** — `process.cwd`/`argv` read directly rather than injected via sthis

*Action*: When Meno provides the `VibesDiyApiIface` dummy, refactor to pass an sthis-style runtime context that includes cwd, argv, output.

## CI/CD workflow (.github/workflows/use-vibes-publish.yaml)

- **Deno install** — still uses `actions/runtime` which installs deno; Meno wants npm deno package instead
- **Inline scripts** — CI steps are shell commands, not consolidated into `package.json` scripts
- **Individual builds** — packages built with `--filter` individually, Meno prefers all-or-nothing

*Action*: These are pre-existing CI patterns from the base branch. Address in a dedicated CI refactor, not this PR.
