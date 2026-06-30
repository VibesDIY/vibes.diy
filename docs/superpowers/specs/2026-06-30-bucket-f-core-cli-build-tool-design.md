# Bucket F — the `@fireproof/core-cli` build tool: inventory + decision record

Issue: [#2483](https://github.com/VibesDIY/vibes.diy/issues/2483) (deferred
build-toolchain item from [#2459](https://github.com/VibesDIY/vibes.diy/pull/2459) /
[#2470](https://github.com/VibesDIY/vibes.diy/issues/2470) /
[#2478](https://github.com/VibesDIY/vibes.diy/issues/2478)).

Status: **DESIGN / DECISION RECORD — recommends DEFER the build-tool
replacement. No code migration in this change; this is the brainstorm/spec the
issue asked for "before any code."**

## Problem

The CLI-framework runtime coupling to `@fireproof/core-cli` is now contained
behind the `cli-kit.ts` seam (#2478). What remains untouched and unowned is the
**build-tool** coupling: `core-cli tsc` / `core-cli build` / `pack` / `publish`
wired through package `scripts` across the monorepo, plus the
`@fireproof/core-cli` devDependency that backs them. The #2478 spec explicitly
carved this out as "Bucket F (build toolchain), a separate concern. Not this
issue." This document inventories that **build-tool** surface and records a
decision on whether to extract/replace it now or defer.

### Not Bucket F: the remaining _runtime_ core-cli imports (already owned)

To be precise about scope — Bucket F is the build tool, **not** every reference to
`@fireproof/core-cli`. Two runtime _source_ imports of the package still exist,
and both are deliberately owned elsewhere and out of scope here:

- **`vibes-diy/cli/cli-kit.ts`** — the CLI-framework (`cmd-ts`) progress/streaming
  primitives, contained behind the #2478 seam.
- **`vibes.diy/identity/node.ts:33-34`** — the login/device-id symbols
  (`deviceIdRegisterEvento`, `isResDeviceIdRegister`, `ReqDeviceIdRegister`),
  owned by `@vibes.diy/identity` per #2459. Note this is the **one place
  `@fireproof/core-cli` is a runtime `dependency`** (not a devDependency) — in
  `vibes.diy/identity/package.json`. It rides along with the identity seam, not
  the build tool, so retiring the build-tool devDependency would _not_ remove it.

So the build-tool coupling this spec governs is package `scripts` + the
devDependency; the runtime symbol coupling is two already-owned seams, called out
here only so the inventory below isn't read as "the only core-cli left is the
build tool."

## What the tool actually does (two distinct surfaces)

`core-cli` shows up in two roles that have very different replaceability:

### 1. `core-cli tsc` — the monorepo typecheck/emit wrapper

Used as the `build` (and `typecheck`/`tsc`) script in most workspace packages,
often chained with a real bundler (`&& vite build`, `&& wrangler build`,
`&& react-router build`, `&& storybook build`). It is the repo's `tsc` front-end:
discovers the package's tsconfig and runs the TypeScript compiler. The root
`build` script is literally `core-cli tsc`, and `agents/code-quality.md` documents
its lint relationship ("transpiled, not typechecked by `core-cli tsc`"). This is
the **lower-risk, more tractable** half — it is, at bottom, "run `tsc`."

### 2. `core-cli build` — the isolated publish build (load-bearing)

Used as `pack` (`core-cli build --doPack`) and `publish` (`core-cli build`). This
is **not** just `tsc` — it is a publish pipeline that, per the June 2026 publish
hardening work and its blog seeds
([`notes/blog-seeds/2026-06-29-the-relative-import-that-only-broke-at-publish.md`](../../../notes/blog-seeds/2026-06-29-the-relative-import-that-only-broke-at-publish.md),
[`notes/blog-seeds/2026-06-30-publish-build-guard-all-packages.md`](../../../notes/blog-seeds/2026-06-30-publish-build-guard-all-packages.md)):

- copies **only this package's** sources into an isolated `dist/npm/` tree;
- runs a standalone `tsc` there with `include: ["**/*"]` (every file a compile
  root, then follows imports) — this is precisely what catches the
  "compiles-in-the-bundle but breaks-at-publish" class of bug that a normal dev
  build never exercises;
- emits the export map / package shape for the published artifact;
- `--doPack` packs a tarball (dry run); the bare `publish` form pushes to npm and
  is the command the credentialed release workflow runs;
- the `-x '^'` variant (external npm packages only — see table) selects publish
  behavior distinct from the internal `@vibes.diy/*` packages.

This half is **deeply load-bearing**: it encodes the isolated-publish-build
invariant that CI now hard-gates. `.github/workflows/ci.yaml`'s `publish_build`
job runs `pnpm -r run --if-present pack` (i.e. `core-cli build --doPack` for every
real package) as a **required** check on every non-docs PR (#2862 / #2864 / #2879).
The team's most recent toolchain investment _doubled down_ on `core-cli build` as
the publish path — replacing it now would mean reimplementing that pipeline and
re-validating the guard against it.

## Inventory (verified against this branch's working tree)

### Scripts

- **33** workspace packages invoke `core-cli` in their `scripts`.
- **52** `core-cli build` occurrences and **36** `core-cli tsc` occurrences across
  all `scripts` (matches the issue's "~33 scripts" order of magnitude when counted
  per-package; higher when counted per-script-entry because `pack` + `publish` +
  `build` each name it).

### Dependency declarations

- **22** `@fireproof/core-cli` declarations (matches the issue's "~22 devDeps"),
  split **20 `devDependencies` + 2 runtime `dependencies`**. The 2 runtime
  `dependencies` are exactly the two runtime-seam owners — `vibes-diy`
  (the CLI, `cli-kit.ts`) and `vibes.diy/identity` (the login/device-id seam) —
  i.e. not the build-tool surface; see "Not Bucket F" above. The 20 devDeps are
  the build-tool consumers.
- Versions: **21 pin `0.24.19` exactly; 1 outlier**
  (`vibes.diy/stories/package.json`, a devDep) uses `^0.24.19`. See "Reduce where
  practical."

### Packages by publish role

| Role                                     | Pack/publish                    | Packages                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **External npm** (caret-rewrite publish) | `core-cli build -x '^'`         | `call-ai/pkg`, `call-ai/v2`, `img-vibes/pkg`, `prompts/pkg`, `use-vibes/base`, `use-vibes/pkg`, `use-vibes/types`, `vibes-diy`                                                     |
| **Internal `@vibes.diy/*`**              | `core-cli build`                | `vibes.diy/api/{impl,pkg,queue,sql,svc,types}`, `vibes.diy/base`, `vibes.diy/identity`, `vibes.diy/vibe/{db-explorer,runtime,srv-sandbox,types}`                                   |
| **App / not published** (stub)           | `echo core-cli build …` (no-op) | `vibes.diy/{pkg,stable-entry,stories}`, `vibes.diy/api/tests`, `vibes.diy/tests/{app,simple-chat}`                                                                                 |
| **Build-only** (no publish)              | — (just `core-cli tsc`)         | root `package.json`, `vibes.diy/api/logpush-etl` (`&& wrangler build`), `call-ai/tests/{integration,unit}`, `prompts/tests`, `use-vibes/tests`, `use-vibes/examples/react-example` |

So **20 packages** run a _real_ `core-cli build` publish (8 external + 12
internal); 6 are echo-stubs that build nothing; the rest only use the `tsc`
front-end.

## Options + trade-offs

### A. Keep as-is — **recommended (defer)**

- **Cost:** none. **Risk:** none.
- The build-time coupling is single-versioned (`0.24.19`) and centralized through
  package scripts; it is already _contained_ in the sense that no source file
  invokes the build tool by import — it is only ever called as a script. (The two
  runtime _symbol_ imports of `@fireproof/core-cli` are the already-owned identity
  / `cli-kit` seams above, not this build-tool surface.)
- The publish-build behavior is exercised on every PR by the `publish_build`
  required check, so regressions in _our_ use of it surface immediately.

### B. Replace `core-cli build` (publish pipeline) with standard tooling now

- **Cost:** high. Reimplement isolated source copy + dist tsconfig
  (`include: ["**/*"]`) + export-map emit + workspace→version-range rewrite
  (`-x '^'`) + pack/publish, across 20 packages, then prove
  **byte-for-byte-equivalent published artifacts** (acceptance criterion).
- **Risk:** high, and _outward-facing_ — esm.sh caches bad URLs (per `CLAUDE.md`),
  so a wrong publish can't be quietly rolled back. Directly against the grain of
  the June 2026 work that just standardized on `core-cli build` as the guard.
- **Payoff now:** low — the coupling isn't currently causing pain.

### C. Replace `core-cli tsc` (typecheck/emit) with `tsc -b` / `tsgo`

- **Cost:** medium. The replacement compilers are **already devDependencies**
  (`typescript@6.0.3`, `@typescript/native-preview` a.k.a. tsgo). The work is
  per-package tsconfig wiring (project references / `outDir`) and confirming emit
  output matches, plus reconciling the lint relationship documented in
  `agents/code-quality.md`.
- **Risk:** medium and _internal-only_ (typecheck/dev build, not published bytes),
  so it is the only slice that could be staged safely later.
- **Payoff now:** low-to-moderate — removes the `tsc`-front-end dependency but
  leaves `core-cli build` (the harder coupling) in place, so it does **not**
  retire the devDependency. Doing C without B is mostly churn.

### D. Wrap behind an internal seam (like #2478's `cli-kit.ts`)

- A script-level seam adds little: scripts already centralize the dependency, and
  a wrapper script/bin would be indirection without removing the backing dep.
  Rejected as ceremony — the #2478 seam worked because it converted _unbounded
  source imports_ into one auditable file; there is no analogous unbounded surface
  here (you can't accidentally `import` a build tool).

## Decision record

**Defer the replacement; keep `@fireproof/core-cli` as the build tool for now
(Option A), and document the coupling (this spec + the runbook note).** Rationale:

1. **No present pain, real present value.** The tool works, is single-versioned,
   and its publish path is the thing CI's required `publish_build` guard exercises
   on every PR. Replacing it trades a working, guarded pipeline for migration risk
   with no current payoff.
2. **The risky half is outward-facing and recently re-committed-to.** `core-cli
build` produces _published npm bytes_; esm.sh caches bad URLs; and #2862/#2864/
   #2879 (June 2026) deliberately standardized on it as the guard. Re-implementing
   it now fights the most recent decision and can't be cheaply rolled back.
3. **The tractable half (C) doesn't retire the dependency.** Swapping `core-cli
tsc` for `tsgo`/`tsc -b` is the only lower-risk slice, but on its own it leaves
   `core-cli build` — and therefore the devDependency — in place, so it's churn
   without the win.

This satisfies the issue's acceptance criteria: a clear decision record with
rationale (defer), and the coupling **documented** (here + `agents/deploy-tags.md`)
and **reduced where practical** (below). The byte-for-byte-equivalence criterion is
conditional on migrating and is therefore not triggered.

### Reduce where practical (safe now)

- **Pin consistency:** align the lone `^0.24.19` outlier in
  `vibes.diy/stories/package.json` to the exact `0.24.19` that the other 21
  declarations use. _Deferred to a follow-up that can run `pnpm install`_ — the
  change is a one-character edit but requires a `pnpm-lock.yaml` regen to keep
  `--frozen-lockfile` CI green, which this branch can't validate offline. Tracked
  as a quick-win, not done blind here.

### Revisit triggers (when to promote out of "defer")

Reopen the extract/replace question when **any** of these lands:

- `@fireproof/core-cli` goes unmaintained or a security advisory hits it;
- a TypeScript/tsgo bump breaks `core-cli tsc` and the upstream lags;
- we need a publish-build behavior `core-cli` doesn't offer (new export shape,
  provenance/attestations, a different registry flow);
- the version drifts across packages (more than the single outlier above).

At that point, stage it **C-then-B, package-by-package**: migrate the `tsc`
front-end first (internal, reversible), then the publish build one package at a
time behind the `publish_build` guard, asserting tarball equivalence
(`npm pack` diff) per package before advancing.

## Non-goals

- No code migration of the build scripts in this change.
- No change to the runtime `cli-kit.ts` seam (#2478) or the identity seam (#2459).
- No `pnpm-lock.yaml` edit (the pin-consistency quick-win is deferred to a session
  that can install + regen the lockfile).

## Verification

This change is documentation only (a spec + a runbook note + a blog seed); the
inventory figures above were verified against the working tree
(`grep`/`package.json` scans) and against `.github/workflows/ci.yaml`'s
`publish_build` job. No build/test behavior changes, so the existing CI checks are
the regression guard.

Refs #2459, #2470, #2478, #2482.
