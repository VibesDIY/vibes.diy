# @vibes.diy/deploy-cli

Deploy-secrets CLI tooling for the monorepo. Currently carries the single
`writeEnv` command the CI/deploy pipeline uses to turn `--fromEnv KEY` flags into
a JSON blob piped to `wrangler secret … bulk`.

This package exists to **retire the last `@fireproof/core-cli` runtime
dependency** (VibesDIY/vibes.diy#2905). `writeEnv` was lifted mechanically from
`@fireproof/core-cli`'s `cmds/write-env-cmd.ts`, with `SuperThis.env` /
`@fireproof/core-runtime` swapped for cement's `envFactory()` and node `path`, so
this package carries **zero** `@fireproof/core-*` dependency (direct or
transitive). It is intentionally separate from `@vibes.diy/build-cli`, which is
build-only and must stay runtime-clean.

The bin is named `deploy-cli` (not `core-cli`) so it never collides with
`@vibes.diy/build-cli`'s `core-cli` bin. The four deploy call sites invoke
`run.js` by direct workspace path:

```bash
node vibes.diy/deploy-cli/run.js writeEnv --out - --json --fromEnv KEY_A …
```

See `docs/superpowers/specs/2026-06-30-rehome-writeenv-retire-core-cli-design.md`.
