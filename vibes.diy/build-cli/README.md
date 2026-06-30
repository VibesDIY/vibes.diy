# @vibes.diy/build-cli

In-sourced build tooling for the vibes.diy monorepo. Provides the `core-cli` bin
used by package `build` / `pack` / `publish` scripts:

- `core-cli tsc` — typecheck/emit via `tsgo` (override with `FP_TSC`).
- `core-cli build [--doPack]` — the isolated publish build: copy sources, write
  the published `package.json` with dependency pinning (see `version-pinner.ts`),
  then `pack` a tarball or `publish` to npm.

This is the **build-tool slice** lifted mechanically from `@fireproof/core-cli`
(`fireproof-storage/fireproof`, the `cli/` package) so the monorepo no longer
depends on that external package for its build harness. The lift is deliberately
trimmed to the build commands only: it pulls in **zero** `@fireproof/core-*`
runtime packages. The runtime commands (`device-id`, `cloud-token`, `well-known`,
…) and the `cmd-ts`/device-id seams are owned elsewhere and are out of scope here.

Private, never published to npm — consumed only via its `core-cli` bin within the
workspace. See `docs/superpowers/specs/2026-06-30-bucket-f-core-cli-build-tool-lift-brief.md`.
