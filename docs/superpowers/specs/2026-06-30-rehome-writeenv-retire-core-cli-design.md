# Design: rehome the `writeEnv` deploy command, retire the last `@fireproof/core-cli`

Issue: [#2905](https://github.com/VibesDIY/vibes.diy/issues/2905) (runtime-seam
follow-on 1 of 2). Sits on top of the Bucket F build-tool lift
([#2904](https://github.com/VibesDIY/vibes.diy/issues/2904) /
[`2026-06-30-bucket-f-core-cli-build-tool-lift-brief.md`](2026-06-30-bucket-f-core-cli-build-tool-lift-brief.md))
and the identity follow-on
([#2906](https://github.com/VibesDIY/vibes.diy/issues/2906)).

**Status: DESIGN — for review before implementation.** No code lands from this
file; it settles _what_ to build and _where_, and surfaces the open questions a
reviewer should weigh in on. The implementation PR follows on the same branch.

## What #2905 actually asks for now (re-scoped)

The issue title — "in-source the cmd-ts CLI-framework primitives behind
`cli-kit.ts`" — describes work that is **already done**. As of #2895/#2470,
[`vibes-diy/cli/cli-kit.ts`](../../../vibes-diy/cli/cli-kit.ts) re-exports
`isCmdProgress` / `isCmdTSMsg` / `sendProgress` (+ the `CmdProgress` / `CmdTSMsg`
/ `WrapCmdTSMsg` types) from **`@vibes.diy/cmd-tools`**, not `@fireproof/core-cli`.
`vibes-diy` has **zero source imports** of `@fireproof/core-cli`.

So the symbol re-point the title names is closed. But the issue's _Goal_ — "drop
the runtime `dependency` from `vibes-diy/package.json`" — is **not** met, because
one thing still needs the installed `@fireproof/core-cli` package: the deploy
pipeline's `writeEnv` command. This spec covers rehoming that command, which is
the real remaining blocker to closing #2905.

## The one remaining coupling: `core-cli writeEnv`

After Bucket F, the root `core-cli` bin provider is `@vibes.diy/build-cli`, which
carries **only** the lifted `tsc` / `build` commands. `writeEnv` was **not**
lifted (it is deploy-secrets tooling, out of build-cli's build-only charter), so
`vibes-diy` is retained purely so its installed `@fireproof/core-cli` keeps
providing `core-cli writeEnv` to the deploy jobs.

### The four call sites (all by explicit path)

All four shell out to `vibes-diy`'s copy by path — none go through the `core-cli`
bin on `PATH`:

| File                                                                                                          | Working dir                 | `../` depth | Secrets pushed                  |
| ------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------- | ------------------------------- |
| [`.github/workflows/vibes-diy-pr-preview.yaml`](../../../.github/workflows/vibes-diy-pr-preview.yaml) (~L237) | `vibes.diy/pkg`             | `../../`    | preview worker (22 `--fromEnv`) |
| [`vibes.diy/actions/deploy/action.yaml`](../../../vibes.diy/actions/deploy/action.yaml) (~L167)               | `vibes.diy/pkg`             | `../../`    | pkg worker (full prod set)      |
| `vibes.diy/actions/deploy/action.yaml` (~L255)                                                                | `vibes.diy/api/queue`       | `../../../` | api-queue consumer              |
| `vibes.diy/actions/deploy/action.yaml` (~L304)                                                                | `vibes.diy/api/logpush-etl` | `../../../` | logpush-etl (1 `--fromEnv`)     |

Each invocation is the same shape:

```bash
node ../../vibes-diy/node_modules/@fireproof/core-cli/run.js writeEnv --out - --json \
  --fromEnv KEY_A --fromEnv KEY_B … ${OPTIONAL:+--fromEnv OPTIONAL}
# → JSON {KEY_A: "...", KEY_B: "..."} on stdout → piped to `wrangler secret … bulk`
```

### The contract we must preserve (deploy-relevant surface only)

From the call sites, the behavior the deploy depends on is narrow:

- **`--out -`** — write to stdout.
- **`--json`** — emit a single JSON object.
- **`--fromEnv KEY`** (repeatable) — read `process.env[KEY]` and put it in the
  object under `KEY`. Optional vars are gated by the shell (`${VAR:+--fromEnv VAR}`),
  so an absent optional key simply never reaches the command; required keys are
  always passed and are expected present.

Per the #2905 status comment, upstream `write-env-cmd.ts` (in
`fireproof-storage/fireproof`) additionally:

- imports `@fireproof/core-runtime` only for `rt.sts.envKeyDefaults.PUBLIC`, used
  in the **no-`--fromEnv` local-dev branch the deploy never hits**, and
- reads env via `SuperThis.env.gets` (REQUIRED / OPTIONAL / literal semantics via
  `@adviser/cement` `param`) and writes via `pathOps`.

The trim is the same one `tsc` got in build-cli: **swap `SuperThis.env.gets` for
`process.env` and drop the `core-runtime` import**, so the rehomed command has
**zero** `@fireproof/core-*` dependency (direct or transitive) — the same hard
gate Bucket F's build-cli had to satisfy.

> **Implementation gate (do this first):** pull the real upstream
> `cli/cmds/write-env-cmd.ts` source and replicate its `--fromEnv` /
> required-vs-optional / JSON-shape behavior **exactly** before repointing any
> deploy site — do not reverse-engineer the contract from the call sites alone.
> Source access is the same blocker the Bucket F lift brief hit (`add_repo
fireproof-storage/fireproof`, or fetch the published dist tarball:
> `npm view @fireproof/core-cli@0.24.19 dist.tarball`). A subtly-wrong `writeEnv`
> silently pushes wrong/missing worker secrets — CI cannot catch it.

## Decision 1 — where `writeEnv` lives

Three options:

**(A) New `@vibes.diy/deploy-cli` workspace package — RECOMMENDED.** A small
package mirroring `vibes.diy/build-cli`'s shape (trimmed `cli-ctx` / `cmd-evento`
/ `create-cli-stream` / `main` harness + one `cmds/write-env-cmd.ts`), `bin: {
"core-cli": "run.js" }` so the `… run.js writeEnv` call shape is preserved with
only a path change.

- _Pros:_ keeps build-cli's **build-only charter and its zero-`core-*` hard gate
  clean** (no risk of dragging `core-runtime` back in); gives deploy-secrets
  tooling a named home for the future (`set-scripts`, `update-deps`, and friends
  could land here later); stays faithful to the owner's "mechanical lift into the
  monorepo" north star.
- _Cons:_ a whole package (build script, pack-guard wiring, devDep) for what is
  ~70 lines + harness today.

**(B) Fold `writeEnv` into `@vibes.diy/build-cli`.** Add a `writeEnv` cmd next to
`tsc` / `build`.

- _Pros:_ no new package; reuses the existing harness verbatim.
- _Cons:_ **muddies build-cli's charter** (it's named and scoped build-only) and
  puts the zero-`core-*` hard gate at ongoing risk — the trim removes the
  `core-runtime` import, but a future careless edit to this command could
  reintroduce it inside the package CI asserts is runtime-clean.

**(C) Standalone `write-env.mjs` script (no framework).** The deploy use is so
narrow (read N env vars → emit JSON) that a ~20-line dependency-free Node script
covers it.

- _Pros:_ smallest possible surface; zero deps; trivially auditable.
- _Cons:_ diverges from the "vendor real source mechanically, byte-equivalent"
  north star; drops the command's other modes (file output, defaults); a bespoke
  re-implementation is exactly what the owner asked _not_ to do for the build
  slice.

**Recommendation: (A).** It preserves both north stars (monorepo-owned,
mechanically lifted) and keeps the Bucket F hard gate isolated. If the reviewer
weighs the one-command package as over-engineered, (C) is the clean fallback —
but (B) is the one to avoid, because it re-couples the build package to a runtime
risk it was just freed from.

## Decision 2 — how the deploy sites reference the new home

Today: `node ../../vibes-diy/node_modules/@fireproof/core-cli/run.js writeEnv …`.

With **(A)**, the simplest repoint is the workspace package's own checked-out path
(the repo is checked out at deploy time), e.g. from `vibes.diy/pkg`:
`node ../build-cli/run.js writeEnv` → `node ../deploy-cli/run.js writeEnv`
(adjust `../` depth per site). That drops the `vibes-diy/node_modules/...`
indirection entirely and no longer depends on `vibes-diy` having the package
installed.

Open sub-question for the reviewer: prefer the **direct workspace path**
(`vibes.diy/deploy-cli/run.js`) or routing through a **`pnpm exec` / bin on
PATH** (more robust to layout changes, but the bin name `core-cli` now collides
with build-cli's bin — they'd both claim `core-cli`). The path form sidesteps the
bin-name collision; recommend it.

## Decision 3 — the trivial last step (drop the dep)

Once `writeEnv` has an in-repo home and the four sites are repointed:

1. Remove `@fireproof/core-cli` from `vibes-diy/package.json` `dependencies`.
2. Switch `vibes-diy`'s own `build` / `pack` / `publish` scripts off the
   `@fireproof/core-cli`-provided `core-cli` bin: add an explicit devDep on
   `@vibes.diy/build-cli` (the no-own-declaration-bin trap the Bucket F brief
   flagged — don't let it resolve via hoisting).
3. Confirm `vibes-diy`'s vitest project + full `pnpm build` + the `publish_build`
   pack guard stay green.

After this lands (plus #2906, already merged), the workspace has **zero**
`@fireproof/core-cli` declarations — the original #2483 north star.

## Blast radius & validation (CI can't cover this)

The four sites run only on **real prod / cli deploys and the PR preview deploy** —
PR `compile_test` / unit CI never exercises them. A wrong `writeEnv` pushes
wrong/missing worker secrets, which is **not** a clean `git revert` (it changes
live worker config), so per
[`agents/pr-lifecycle.md` § Autonomous merge loop](../../../agents/pr-lifecycle.md#autonomous-merge-loop--and-when-to-hold-for-a-human)
this is a **hold-for-human deploy**, not an auto-merge.

Validation plan, before flipping prod:

1. **Byte-equivalence of output.** With a representative env set, diff the JSON
   `writeEnv` emits from the old `@fireproof/core-cli` vs. the rehomed command —
   identical keys, identical values, identical shape. Automate this as a unit
   test in the new package (the same "prove byte-equivalence" bar Bucket F used).
2. **Preview deploy** exercises the `vibes-diy-pr-preview.yaml` site for real on
   this PR — verify the preview worker comes up with its secrets set.
3. **Stage on `@c` (cli env)** through `vibes.diy/actions/deploy/action.yaml`
   before prod, then watch the prod deploy deliberately.

## Acceptance criteria (closes #2905)

- `writeEnv` served from monorepo-owned code with **zero** `@fireproof/core-*`
  dependency (direct or transitive); the upstream contract (`--out -`, `--json`,
  repeatable `--fromEnv KEY`, required-vs-optional behavior) replicated exactly.
- All four deploy sites repointed off `vibes-diy/node_modules/@fireproof/core-cli`.
- `@fireproof/core-cli` removed from `vibes-diy`'s `dependencies`; its build
  scripts run on an explicit `@vibes.diy/build-cli` devDep.
- `vibes-diy` vitest + full `pnpm build` + `publish_build` pack guard green;
  output-byte-equivalence test green.
- Validated on preview + `@c` before the prod deploy; PR held for a human merge.

## Open questions for review

1. **Package vs. script (Decision 1):** new `@vibes.diy/deploy-cli` (A,
   recommended) vs. a standalone `write-env.mjs` (C)? Is a one-command package
   worth its overhead, or is the script the better fit for a command this narrow?
2. **Bin-name collision (Decision 2):** confirm the **direct workspace path**
   repoint (avoiding a second package claiming the `core-cli` bin name) over a
   PATH/`pnpm exec` form.
3. **Source access:** can we get `fireproof-storage/fireproof` in scope to lift
   the real `write-env-cmd.ts`, or do we vendor from the published dist tarball?
4. **Scope creep:** lift only `writeEnv`, or also the other deploy-adjacent cmds
   (`set-scripts`, `update-deps`) now while we're building the home? (Inventory
   says only `writeEnv` is invoked at runtime — recommend `writeEnv` only.)

Refs #2483, #2478, #2895, #2904, #2906.
