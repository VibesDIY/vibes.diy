# CLI-framework proxy seam — decoupling `cmd-ts` glue from `@fireproof/core-cli`

Issue: [#2470](https://github.com/VibesDIY/vibes.diy/issues/2470) (follow-up from [#2459](https://github.com/VibesDIY/vibes.diy/pull/2459), the identity-extraction far shore).

Status: **DESIGN — reviewed and approved by `@CharlieHelps`; ready for an implementation plan pending owner go-ahead.**

## Problem

The far-shore work (#2459) routed every _identity_-relevant `@fireproof/*` import
through the `@vibes.diy/identity` seam. One deliberately-excluded thread remained:
the `vibes-diy` CLI still imports generic **`cmd-ts` framework primitives**
directly from `@fireproof/core-cli` (progress/streaming/evento glue that the CLI's
message pipeline is built on). These are CLI-framework, not identity — so they
stayed on `core-cli` rather than being forced into the identity package.

That leaves a small, direct runtime coupling to `@fireproof/core-cli` outside the
seam. Per the encapsulation principle established in #2459, it should route through
a proxy so the coupling can't regrow and the internals can be swapped later behind
a stable boundary.

## Inventory (verified against current `origin/main`)

The coupling is **6 symbols imported in one file** — of which only **3 are runtime
coupling** (the values, which actually link `core-cli`); the other 3 are type-level
and erase at build:

| Symbol                                        | Kind           | Imported in                                                              |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------ |
| `isCmdProgress`, `isCmdTSMsg`, `sendProgress` | runtime values | [`vibes-diy/cli/cmd-evento.ts:15`](../../../vibes-diy/cli/cmd-evento.ts) |
| `CmdProgress`, `CmdTSMsg`, `WrapCmdTSMsg`     | types          | same line                                                                |

Nothing else in source imports `@fireproof/core-cli` at runtime. (The local
`cmd-ts-stream.ts` / `cmd-evento.ts` glue is already ours; it only reaches
`core-cli` through those 6 symbols.)

### Explicitly out of scope

- **Login symbols** — `deviceIdRegisterEvento`, `isResDeviceIdRegister`,
  `ReqDeviceIdRegister` are identity, already owned by
  [`@vibes.diy/identity/node`](../../../vibes.diy/identity/node.ts). Untouched.
- **The `core-cli` build tool** — `core-cli tsc` / `build` / `pack` / `publish`
  across ~33 package scripts and ~22 devDependencies is **Bucket F** (build
  toolchain), a separate concern. Not this issue.
- **The internals swap** — reimplementing the `cmd-ts` streaming/evento glue (or
  moving to a maintained CLI framework) is the deferred "deep water." This spec
  only makes it _possible_ later; it does not do it.

## Design

A **single local re-export module** in the CLI package — no new workspace package
(the surface is one file, all within `vibes-diy/cli`, so a dedicated package would
be ceremony without payoff).

### `vibes-diy/cli/cli-kit.ts` (new)

```ts
// CLI-framework (cmd-ts) seam. The single point where the vibes-diy CLI couples
// to @fireproof/core-cli's progress/streaming primitives. Import these from here,
// never from "@fireproof/core-cli" directly, so the coupling stays contained and
// the internals can be swapped (native cmd-ts glue, or another framework) behind
// this boundary. core-cli remains the internal backing for now.
export { isCmdProgress, isCmdTSMsg, sendProgress } from "@fireproof/core-cli";
export type { CmdProgress, CmdTSMsg, WrapCmdTSMsg } from "@fireproof/core-cli";
```

### `vibes-diy/cli/cmd-evento.ts` (modify)

Change the one import line from `@fireproof/core-cli` to `./cli-kit.js`. No other
changes.

### Boundary

After this, the only file in `vibes-diy/cli` that names `@fireproof/core-cli` for
the CLI-framework layer is `cli-kit.ts`. The login symbols continue to flow through
`@vibes.diy/identity/node` (their correct owner), so `cmd-evento.ts` keeps that
import too — the two seams are orthogonal and both leave `core-cli` as the internal
backing.

## Decision record

**Extract now.** Rationale: ~1 file of pure re-export churn, zero behavior change,
consistent with the #2459 precedent, and it converts an unbounded coupling
("any CLI file could import core-cli") into a single auditable seam. The cost of
deferring (the coupling silently regrowing as the CLI gains commands) exceeds the
cost of the seam. Reaching for a workspace package was rejected as over-engineering
for a one-file surface (see the brainstorm: local module chosen over
`@vibes.diy/cli-kit` / extending `@vibes.diy/identity`).

## Verification

- `pnpm build` (full monorepo typecheck) green — the re-export must resolve and
  the types must line up.
- The `vibes-diy` vitest project passes unchanged — behavior is identical (pure
  re-export), so existing CLI tests are the regression guard.
- Optional smoke test (see open question b).

## Non-goals

- No new workspace package.
- No change to the login/identity seam or the `core-cli` build tooling.
- No reimplementation of the `cmd-ts` glue.

## Resolutions (from `@CharlieHelps` review)

- **(a) Filename → `cli-kit.ts`.** Names the local abstraction; `cmd-ts-kit.ts` would
  leak today's internals and `core-cli-seam.ts` hard-codes the current backing dep.
- **(b) Typecheck/build-only — no smoke test.** A dropped symbol in a pure re-export
  with one local consumer fails `pnpm build` immediately. Add a seam-contract test
  only if `cli-kit` gains multiple consumers or evolves independently during a future
  internals swap.
- **(c) Boundary confirmed.** Login/device-id symbols stay identity-owned in
  `@vibes.diy/identity`; this seam stays focused on CLI-framework glue only.
