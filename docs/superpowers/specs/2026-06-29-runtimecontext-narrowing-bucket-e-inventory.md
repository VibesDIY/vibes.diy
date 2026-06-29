# RuntimeContext narrowing (Bucket E) — call-site inventory & contracts

> Tracking issue: [#2468](https://github.com/VibesDIY/vibes.diy/issues/2468). Follow-up
> from #2459 (deferred item 4) / the de-fireproof roadmap's **Plan 4 — `SuperThis`
> decision (Bucket E)**.

## Plain-language summary

We still recover runtime context dynamically through `ensureSuperThis()` at a number
of call sites. That broad recovery hides what each path actually needs from the
runtime and keeps identity/core flows coupled to the full `@fireproof/core-runtime`
`SuperThis`. This doc inventories every `ensureSuperThis` call site, categorizes it,
defines the target context contract, and records the rationale for the uses that
deliberately stay broad. It is the design-first artifact for the phased narrowing.

## The contract seam (today)

`@vibes.diy/identity` already exposes a narrow seam:

```ts
// vibes.diy/identity/runtime-context.ts
export type RuntimeContext = Pick<SuperThis, "env" | "txt" | "nextId">;
export function ensureRuntimeContext(): RuntimeContext; // delegates to ensureSuperThis() in v1
```

`RuntimeContext` is the **target contract** for any call site whose only runtime
needs are env access, text codecs (base58/base64/utf8), and id generation. A call
site that consumes a wider surface (`logger`, the fireproof database/keybag glue, or
anything passed into `sts.*` / `createDeviceIdGetToken` / `QueueCtx` / `VibesDiyApi`)
genuinely needs the full `SuperThis` and is **not** a narrowing target until that
downstream surface is itself narrowed — explicitly out of scope here, and reserved for
the later `SuperThis` decision (drop `@fireproof/core-runtime`).

## Inventory (non-test source call sites)

| Call site                                                                | Surface used                                                    | Category                           | Action                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| `use-vibes/base/utils/appSlug.ts`                                        | `nextId` only                                                   | **Narrowable**                     | ✅ migrated to `ensureRuntimeContext()` |
| `call-ai/v2/cli.ts`                                                      | `nextId` only                                                   | **Narrowable**                     | ✅ migrated to `ensureRuntimeContext()` |
| `vibes.diy/api/svc/cf-serve.ts`                                          | `ensureSuperThis({ logger })` → `createAppContext`, `R2ToS3Api` | Needs full `SuperThis` (+`logger`) | Keep; document                          |
| `vibes.diy/api/impl/index.ts` (×2)                                       | full API impl: DB, connections, logging                         | Needs full `SuperThis`             | Keep; document                          |
| `vibes.diy/api/queue/worker.ts`                                          | passed into `QueueCtx({ sthis })`                               | Needs full `SuperThis`             | Keep; document                          |
| `vibes-diy/cli/main.ts`                                                  | passed into `createDeviceIdGetToken`, keybag/device-id          | Needs full `SuperThis`             | Keep; document                          |
| `use-vibes/base/fireproof-node.ts`                                       | `loadDeviceIdGetToken(ensureSuperThis())`                       | Needs full `SuperThis`             | Keep; document                          |
| `eval/codegen-edit/src/auth.ts`                                          | `createDeviceIdGetToken(sthis, …)`                              | Needs full `SuperThis`             | Keep; document                          |
| `vibes.diy/pkg/app/vibes-diy-provider.tsx`                               | threads `sthis` through `VibesDiyCtx` (typed `SuperThis`)       | Needs full `SuperThis`             | Keep; document                          |
| `vibes.diy/identity/dash-api/token.ts` (`getCloudPubkeyFromEnv` default) | `sts.env2jwk(…, sthis)`                                         | Needs full `SuperThis`             | Keep; document                          |
| `vibes.diy/identity/runtime-context.ts`                                  | the seam itself                                                 | Seam                               | Keep (intentional)                      |
| `vibes.diy/identity/index.ts`                                            | re-export of `ensureSuperThis`                                  | Facade                             | Keep (intentional)                      |

### Tests (`*.test.ts`, `*-test-ctx.ts`, `api-test-setup.ts`)

The ~80 remaining `ensureSuperThis` hits are **test harnesses** that build a full
runtime context on purpose (they exercise the real API impl, database, and auth
flows). They are not "broad runtime recovery in a production path" and are out of
scope for narrowing. They import `ensureSuperThis` from `@fireproof/core-runtime`
**directly**, which is cosmetic for _this_ narrowing and not required by #2468's
acceptance criteria — but it is **load-bearing for the eventual "drop `core-runtime`"
finish line**: that dep can't leave these packages until the imports are routed
through the `@vibes.diy/identity` seam. Tracked as a Phase 2 prerequisite below.

## Why most source sites stay on `ensureSuperThis` (rationale)

Every "keep" row above passes the recovered context into a downstream API that is
typed against the full `SuperThis`:

- **`createAppContext` / `VibesDiyApi` / `QueueCtx`** — the api impl, app context, and
  queue context all take `sthis: SuperThis` and use the database/connection/logging
  glue beyond the `env`/`txt`/`nextId` triple.
- **`createDeviceIdGetToken` / `loadDeviceIdGetToken` / keybag** — the device-id signer
  and keybag are Node-only crypto that read `SuperThis`'s wider surface.
- **`sts.env2jwk(…, sthis)`** — the fireproof `sts` helpers take a `SuperThis`.
- **`cf-serve.ts`** additionally seeds a `logger`, which is **not** part of
  `RuntimeContext`.

Narrowing these requires first narrowing those downstream signatures (or widening
`RuntimeContext` to carry `logger`/other surface), which is the deep, auth-and-core
touching refactor the roadmap reserves for the dedicated `SuperThis` decision. Doing
it here would be churn against live identity/database flows without the byte-compat
gate that work will carry — see the preservation principle in
`docs/superpowers/plans/2026-06-26-defireproof-identity-runtime-extraction.md`.

## Phasing

- **Phase 1 — DONE (#2826):** establish the inventory + contracts; migrate the two
  source sites that only need `nextId` to the narrow `ensureRuntimeContext()` seam.
- **Phase 2 — DONE (#2833):** route the 74 test-harness `ensureSuperThis` imports
  from `@fireproof/core-runtime` through the `@vibes.diy/identity` seam (behavior-identical
  re-export). This was the load-bearing prerequisite: even after every source site
  narrows, the dep can't leave a package while its tests import core-runtime directly.
- **Phase 3 — DONE (this PR):** with no file outside `vibes.diy/identity` importing
  `@fireproof/core-runtime` anymore (verified by grep — no source/test imports, no
  build-config or `exports`-map references), remove the now-unused dependency
  declaration from all 18 non-identity packages. `@fireproof/core-runtime` now lives
  only in `vibes.diy/identity`, the seam. Split into two commits (internal/test, then
  published/browser) so the publish-risky half is independently revertible.
- **Phase 4 — remaining, to reach zero `@fireproof/core-runtime`** (planned in
  [`docs/superpowers/plans/2026-06-29-bucket-e-phase4-identity-core-runtime-lift.md`](../plans/2026-06-29-bucket-e-phase4-identity-core-runtime-lift.md)):
  - **Replace the identity package's own `core-runtime` use with in-repo impls.** The
    seam still imports `sts`, `ensureSuperThis`, `deepFreeze`, `hashObjectAsync`,
    `hashStringAsync`/`hashStringSync` from `core-runtime` (device-id crypto, keybag,
    CA, clerk-token). Lifting these is the crypto-adjacent finish line (gated by the
    wire-compat harness).
  - **Optional type-tightening (not dep-blocking):** widen `RuntimeContext` to carry
    `logger` (the `cf-serve.ts` case) and narrow the downstream signatures
    (`createDeviceIdGetToken`, `QueueCtx`, `sts.*`, the api impl) so the "keep" sites
    can accept `RuntimeContext` instead of full `SuperThis`. Pure type hygiene now —
    no longer a dep-removal blocker, since all non-identity packages already route
    through the seam.
