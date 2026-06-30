# Bucket F — implementation brief: in-source the `@fireproof/core-cli` build tool

Issue: [#2483](https://github.com/VibesDIY/vibes.diy/issues/2483). Follows the
merged decision record
[`docs/superpowers/specs/2026-06-30-bucket-f-core-cli-build-tool-design.md`](2026-06-30-bucket-f-core-cli-build-tool-design.md)
(PR #2896).

**Status: HANDOFF — actionable lift brief for a more-privileged agent.** This
session settled the goal and approach with the owner and verified the lift is
mechanical/low-risk, but is **blocked on one capability**: pulling the Fireproof
source. See "Why this is a handoff."

## Decision update (supersedes the record's "defer" for this surface)

The merged decision record recommended **defer**. The owner has since set a
clearer north star that changes the call: **in-source `@fireproof/core-cli` into
the monorepo to remove the external dependency outright** — so that "everything is
in the monorepo except truly infrastructure stuff like `@adviser/cement`," for
speed and control. The owner accepts the volume of code **on the condition that it
moves in mechanically at low risk** (vendor the actual code → byte-equivalent
output), not a from-scratch reimplementation.

This brief covers **only the build-tool slice** (Bucket F). See "Kitchen-sink"
for why that's a clean sub-problem and what the follow-ons are.

## Why this is a handoff (the blocker)

The mechanical lift wants the **TypeScript source** of core-cli, which lives in
`fireproof-storage/fireproof` (confirmed via `npm view @fireproof/core-cli
repository`). This session could not get it:

- `add_repo fireproof-storage/fireproof` repeatedly failed with "MCP tool call
  requires approval" — the approval channel was down for the whole session.
- A direct `git clone` is refused by the agent proxy (`403`) because the repo
  isn't in session scope; `add_repo` is the only thing that grants scope.

A more-privileged agent (one that can complete `add_repo`, or that already has the
Fireproof source in scope) can finish this. **Everything else needed is below**,
including a full anatomy derived from the published npm package so the lift target
is unambiguous.

## Kitchen-sink: `@fireproof/core-cli` carries three consumers

A repo-wide audit (and the package's own dep tree) shows the single package backs
**three independent things** we consume. Fully retiring the dependency needs all
three in-sourced; **this issue owns only #1**:

1. **Build-tool bin** — `core-cli tsc` / `build` / `pack` / `publish`. **Bucket F,
   this brief.**
2. **CLI runtime primitives** — the `cmd-ts` `CmdProgress`/`isCmdProgress`/
   `sendProgress` glue, already isolated behind
   [`vibes-diy/cli/cli-kit.ts`](../../../vibes-diy/cli/cli-kit.ts) (#2478).
3. **Device-id / identity symbols** — `deviceIdRegisterEvento` etc., owned by
   [`vibes.diy/identity/node.ts`](../../../vibes.diy/identity/node.ts) (#2459).
   This is the one place `@fireproof/core-cli` is a runtime `dependency`.

So after this lift, two follow-on tickets (in-source the cmd-ts primitives behind
`cli-kit.ts`; in-source the device-id symbols behind `@vibes.diy/identity`) finish
the job of removing `@fireproof/core-cli` entirely. Note them when you open the PR.

## Verified inventory (build-tool surface)

Re-confirmed against current `main` (HEAD `fe1a4d0`):

- **34** workspace packages invoke `core-cli` in `scripts`.
- **22** `@fireproof/core-cli` declarations = **20 `devDependencies` + 2 runtime
  `dependencies`** (the 2 runtime deps are the seam owners `vibes-diy` and
  `vibes.diy/identity` — _not_ build-tool consumers; leave them for follow-ons #2/#3).
- **20** packages run a _real_ (non-`echo`-stub) `core-cli build` publish.
- Scripts split: `core-cli tsc` (build/typecheck, often `&& vite build` /
  `&& wrangler build` / `&& react-router build` / `&& storybook build`) and
  `core-cli build [--doPack]` / `core-cli build -x '^' [--doPack]` (pack/publish).

> **Build the worklist from a live scan, not the merged table.** The decision
> record's "Packages by publish role" table is a useful starting shape, but it was
> taken at base `43f168b` and the tree has drifted: `vibes.diy/cmd-tools`
> (`@vibes.diy/cmd-tools`) was **added** — a real-publish internal package
> (`build: core-cli tsc`, `pack: core-cli build --doPack`, `publish: core-cli
build`) that is **absent from that table** — and `vibes.diy/api/queue`'s publish
> role **changed** (it's no longer a real publish after the `81ef2bc`/`c8b6d08`
> private-package sweep). So re-derive the worklist on the tree you migrate:
>
> ```sh
> # every script consumer (expect 34 today)
> grep -rl "core-cli" --include=package.json --exclude-dir=node_modules .
> # real publishers vs echo-stubs: inspect each package's publish script
> ```
>
> **`@vibes.diy/cmd-tools` is the trap to watch:** it invokes `core-cli` in
> `build`/`pack`/`publish` but **declares no `@fireproof/core-cli` of its own** — it
> resolves the bin via root/hoisted install. When you swap the bin provider to
> `@vibes.diy/build-cli`, a package with no declared dependency can be left with no
> bin and silently break (or keep resolving the old hoisted one). Give it (and any
> other no-own-declaration consumer the live scan finds) an explicit devDep on the
> new package so the pack guard covers the whole workspace.

## Anatomy of the lift target (from `@fireproof/core-cli@0.24.19`, published dist)

Reproduce with: `npm view @fireproof/core-cli@0.24.19 dist.tarball` → fetch →
`tar xzf`. The package is ESM (`"type":"module"`), `bin: { "core-cli": "run.js" }`,
`exports: { ".": "./index.js" }`, ~3,630 LOC of compiled JS (sourcemaps included).

### The build-tool slice (what we actually use) and its import graph

| File (in pkg)                                  | LOC (compiled) | Imports (external)                                                                         | Role                                                                                                                                                                                              |
| ---------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cmds/tsc-cmd.js`                              | ~70            | `cmd-ts`, `zx`, `@adviser/cement`, `arktype`                                               | `core-cli tsc`: runs `[$FP_TSC ?? "tsgo", ...args]` via `zx.$`, with PowerShell-quoting handling. That's the whole command.                                                                       |
| `cmds/build-cmd.js`                            | ~600           | `cmd-ts`, `zx`, `@adviser/cement`, `arktype`, `find-up`, `fs-extra`, `semver`, `node:path` | `core-cli build`: the isolated publish build — `tsc` into `dist/npm`, `writeJSON` the published `package.json`/`exports`, `--doPack` packs a tarball, workspace-dep rewriting via version-pinner. |
| `version-pinner.js`                            | ~200           | `@pnpm/lockfile-file`, `find-up`                                                           | The `-x '^'` logic: rewrites `workspace:`/version specifiers from the pnpm lockfile for published artifacts.                                                                                      |
| `cmd-evento.js`                                | ~100           | `@adviser/cement`, `arktype`                                                               | The evento message registry/glue the cmds register through. **Caveat below — it imports _all_ cmds.**                                                                                             |
| `cli-ctx.js`, `create-cli-stream.js`, `run.js` | ~tiny          | node builtins only                                                                         | Bin entry + stream/context harness.                                                                                                                                                               |

**Critical finding — the slice is cleanly liftable.** The `tsc`/`build`/
`version-pinner` code pulls in **only** standard npm packages plus
`@adviser/cement` (which the monorepo keeps as infra; 26 uses already). It does
**NOT** import `@fireproof/core-runtime`, `core-keybag`, `core-device-id`, or
`core-types-base`. Those appear in core-cli's manifest only because the _full_ CLI
(`main.js` + the other `cmds/*`: device-id, cloud-token, dependabot, well-known,
write-env, pre-signed-url, retry, test-container, set-scripts, update-deps) wires
them. **We don't need those commands for build tooling.**

### External deps the new package will declare

`cmd-ts`, `zx`, `arktype`, `find-up`, `fs-extra`, `semver`, `@pnpm/lockfile-file`,
and `@adviser/cement` (use the workspace's already-patched cement). Plus a TS
compiler: core-cli's `tsc` command defaults to **`tsgo`** (`@typescript/native-preview`)
via the `FP_TSC` env var — the repo already devDepends on tsgo
(`7.0.0-dev.20260627.2`).

## Recommended approach

**Vendor the build-tool slice as an internal workspace package** — working name
`@vibes.diy/build-cli`, `bin: { "core-cli": ... }` so the ~33 scripts that call
`core-cli` keep working with a one-line devDep swap (`@fireproof/core-cli` →
`@vibes.diy/build-cli`). This is the mechanical, byte-equivalent path the owner
asked for.

- **Prefer lifting the TypeScript _source_** from `fireproof-storage/fireproof`
  (the package directory for `@fireproof/core-cli`) over the compiled dist — the
  owner wants readable, ownable source to "move faster." The dist anatomy above is
  the precise map of _which_ files/symbols to take; lift the TS originals of
  exactly those.
- **Trim to the build surface:** take `tsc`, `build` (+ `version-pinner`) and the
  minimal evento/stream harness they need. Drop device-id/cloud/dependabot/etc.
- The alternative (vendor the compiled dist) is a valid fallback if source access
  is impractical, but it owns generated JS — weaker on the "control" goal.

## Staged migration plan (low-risk, reversible)

1. **Create `@vibes.diy/build-cli`** with the lifted `tsc` + `build` +
   `version-pinner` + harness, its own deps, and a `bin` named `core-cli`. Build it
   with the existing toolchain. Add it to the workspace.
2. **Pilot on build-only packages first** (e.g. `call-ai/tests/*`, `prompts/tests`,
   `use-vibes/tests`, root) — swap their `@fireproof/core-cli` devDep → the new
   package and confirm `pnpm build` is unchanged. These have no publish path, so
   the blast radius is just typecheck.
3. **Internal `@vibes.diy/*` packages next** (api/_, vibe/_, base, etc.) — swap and
   verify `pack` (`--doPack`) produces a byte-identical tarball (see Verification).
4. **External npm packages last** (`call-ai/*`, `use-vibes/*`, `prompts/pkg`,
   `img-vibes/pkg`, `vibes-diy`) — these use `-x '^'`; verify the version-pinner
   output matches exactly before any `pkg@*` publish. **esm.sh caches bad URLs**
   (per `CLAUDE.md`) — a wrong published artifact can't be quietly rolled back, so
   gate these behind the byte-diff check.
5. **Remove the `@fireproof/core-cli` devDep** from each package as it migrates;
   when the last build-tool consumer is off it, only the two runtime-seam owners
   remain (follow-ons #2/#3).

## Verification (prove byte-equivalence — this is the acceptance bar)

- The repo already has a **required CI guard**: `pnpm -r run --if-present pack`
  (the `publish_build` job in `.github/workflows/ci.yaml`) builds every package's
  isolated publish build on every non-docs PR. It must stay green throughout.
  (Note: recent `main` commits `81ef2bc`/`c8b6d08` made every non-private package
  carry a real `pack` and assert it — the guard is now strict.)
- **Per-package tarball diff:** before/after migration, run the package's `pack`
  with old core-cli and with `@vibes.diy/build-cli`, untar both, and diff the
  trees. Target: identical (modulo the build-tool's own version string if it
  appears). Automate this for the external packages especially.
- **`tsc` behavior:** confirm `core-cli tsc` still resolves `tsgo` (or honors
  `FP_TSC`) and emits identically; run a full `pnpm build`.

## Caveats / gotchas (don't relearn these)

- **`cmd-evento.js` imports every `cmds/*`** — lifting it verbatim drags in
  device-id/cloud/etc. (and their `@fireproof/core-*` deps). Trim the registry to
  just `tsc` + `build`.
- **`main.js` imports `@fireproof/core-runtime`** — the tsc/build slice does not.
  Don't lift `main.js` wholesale; build a minimal bin entry that registers only the
  build commands.
- **tsgo pin:** core-cli pins `@typescript/native-preview ~7.0.0-dev.20260414.1`;
  the monorepo pins `7.0.0-dev.20260627.2`. The lifted `tsc` command shells out to
  `tsgo`, so use the repo's pinned tsgo and confirm it's resolvable from the new
  package.
- **`@adviser/cement` is patched** in the lockfile (`patch_hash=…`). Use the
  workspace cement; don't re-pin.
- **Coordinate with the publish runbook** ([`agents/deploy-tags.md`](../../../agents/deploy-tags.md))
  — this is release plumbing.

## Open questions for the privileged agent

1. **Source vs dist:** lift the TS source from `fireproof-storage/fireproof`
   (recommended) or vendor the compiled dist (fallback)?
2. **Package name/location:** `@vibes.diy/build-cli`? Under `vibes.diy/` or top-level?
3. **`FP_TSC`/tsgo:** keep core-cli's `tsgo` default + `FP_TSC` override, or
   standardize on the repo's pinned tsgo with no env knob?
4. **Command scope:** lift only `tsc` + `build`, or also the build-adjacent cmds
   (`set-scripts`, `update-deps`, `dependabot`) if any package scripts use them?
   (Inventory shows only `tsc` and `build` in use — confirm.)

## Reproducible artifacts

- Published-package fetch + manifest + import graph above were derived from
  `@fireproof/core-cli@0.24.19` (sha512 `l87V7t2x…wMVxA==`). Re-fetch with
  `npm view @fireproof/core-cli@0.24.19 dist.tarball`.
- Inventory figures: see the merged decision record and re-verify with the
  `grep`/`package.json` scans documented there.

Refs #2483, #2459, #2470, #2478, #2482, #2896.
