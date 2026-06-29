# Bucket E Phase 4 — lift `@fireproof/core-runtime` out of the identity package

> **For agentic workers:** REQUIRED SUB-SKILL — execute this with
> `subagent-driven-development` or `executing-plans`, task-by-task, and **never** cut a
> task over without its wire-compat gate green. This plan touches the byte-for-byte auth
> surface (device certs, keybag keys, JWTs); a silent drift = forced re-login for every
> user. Tracking issue: [#2468](https://github.com/VibesDIY/vibes.diy/issues/2468).

## Where Bucket E stands (Phases 1–3, all merged)

- **Phase 1 (#2826):** narrowed the two `nextId`-only source sites onto `ensureRuntimeContext()`; wrote the inventory/contracts doc.
- **Phase 2 (#2833):** routed the 74 test-harness `ensureSuperThis` imports through the `@vibes.diy/identity` seam.
- **Phase 3 (#2834):** removed the now-unused `@fireproof/core-runtime` dep from all 18 non-identity packages.

**Net:** `@fireproof/core-runtime` is now confined to `vibes.diy/identity` — the seam. Phase 4 is the finish line: lift the identity package's **own** use of it in-repo so the dep (and the `SuperThis`/`core-runtime` coupling) leaves the repo entirely.

**Decision: 4a (reach zero `@fireproof/core-runtime`).** Confirmed feasible by reading the source: `core-runtime`'s `SuperThisImpl` + `ensureSuperThis` is **~200 lines of thin glue over `@adviser/cement`** (`envFactory`, `toCryptoRuntime`, `LoggerImpl`, `AppContext`) + `multiformats` `base58btc` + `TextEncoder/Decoder` — `nextId`, `timeOrderedNextId`, `pathOps`, the `txt` base64/base58 codecs, `start`, `clone`. There is **no bespoke crypto in the context itself**, so the `SuperThis` lift (Task 4) is **low-risk deterministic glue**, a verbatim copy of cement assembly — not a reimplementation. This re-scopes Phase 4: the byte-critical risk is concentrated in **Task 2 (hashes)** and **Task 3 (the `sts` JWT/JWK crypto)**, while Task 4 is mechanical. `cement` is already an identity dep, so the `SuperThis` lift adds no new dependency.

## Why this phase is different (read before touching code)

Phases 1–3 were import-swaps and dead-dep deletions that `tsc` fully validated. Phase 4 **reimplements crypto**:

1. **Byte-compat is a hard release gate.** Existing device certs in `~/.fireproof/keybag`, deployed `DEVICE_ID_CA_*` / `CLOUD_SESSION_TOKEN_*` env material, and live Clerk/device-id JWTs must keep validating. A one-byte change in a hash or JWT field = silent auth breakage / forced re-login. (Same constraint the de-fireproof identity spec ratified.)
2. **Strategy is lift-verbatim, not reimplement.** Copy each function body byte-for-byte from the installed `@fireproof/core-runtime@0.24.19` source, adjusting only import paths. Record source-lock provenance (file + `v0.24.19` SHA) per lifted symbol. Do **not** rewrite an algorithm — gate it instead.
3. **Slicing by symbol stacks deps — don't.** Lifting just the hashes adds `multiformats` + `@adviser/ts-xxhash` to identity while `core-runtime` stays for `sts`/`ensureSuperThis`. That's net-more-dependencies until the _whole_ lift lands (violates the preservation principle). So the tasks below are ordered so the new crypto deps and the `core-runtime` removal land in one coherent arc, and the dep is only dropped at the very end (T5).
4. **Local verification is limited in cloud sessions.** The identity/api suites run under vitest's Playwright browser provider, which isn't provisioned in cloud worktrees. So the golden harnesses are **CI-gated**, not locally runnable here. Mitigation: extend each golden harness with an **extracted ⇄ fireproof cross-verification** seam (mirroring `identity-wire-compat.test.ts`'s device-id pattern) so CI proves byte-equality both directions before the fireproof backing is removed. Anyone running locally in a node-capable env should do so.

## The exact surface to lift (verified against the branch)

| Symbol                                                       | Used in                                                                    | Wire-sensitivity                                                          | New deps it pulls                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `deepFreeze`                                                 | `device-id/certor.ts:36` (freezes the cert payload)                        | None (freeze ≠ serialization)                                             | none — trivial pure recursion                                                           |
| `hashStringSync`                                             | `keybag/key-bag.ts:55` (`deviceIdKey` store key)                           | **Critical** — keybag lookup key                                          | `@adviser/ts-xxhash` (XXH.h64), `multiformats/bases/base58`, `@adviser/cement` (txtOps) |
| `hashStringAsync`                                            | `keybag/key-bag.ts:63` (`urlHash` store key)                               | **Critical** — keybag lookup key                                          | `multiformats` (sha256, CID, json codec)                                                |
| `hashObjectAsync`                                            | `device-id/ca.ts:190` (`subjectKeyIdentifier` in the device cert)          | **Critical** — cert wire format                                           | `multiformats` (sha256, CID, json codec), `@adviser/cement` (toSortedArray)             |
| `hashObjectSync`                                             | re-exported via `index.ts` facade                                          | depends on consumers                                                      | `@adviser/ts-xxhash`, `@adviser/cement` (toSorted)                                      |
| `sts` (`sts-service`: `env2jwk`, `importJWK`, `verifyToken`) | `device-id/{validator,key,verify}.ts`, `dash-api/{clerk-token,token}.ts`   | **Critical** — JWK import + JWT verify + env→jwk; the auth core           | `jose` (already a dep), `@adviser/cement`, possibly `multiformats`                      |
| `ensureSuperThis`, `ensureLogger`, `runtimeFn`               | `runtime-context.ts:19`, `dash-api/token.ts:97` default, `index.ts` facade | Indirect — provides `env`/`txt`/`nextId`/`logger`/crypto to all the above | `@adviser/cement` (`envFactory`, `toCryptoRuntime`, `LoggerImpl`)                       |

`sts` is `export * as sts from "./sts-service/index.js"` in core-runtime; the used surface is `env2jwk` / `importJWK` (×5) / `verifyToken`.

## Existing gates to extend

- `vibes.diy/api/tests/identity-wire-compat.test.ts` — device-id token cross-verify (already has the extracted-factory seam pattern).
- `vibes.diy/api/tests/auth-token-verify-golden.test.ts` — Clerk + device-id verify against fixtures (the "no forced re-login" gate).
- `vibes.diy/identity/keybag/keybag-golden.test.ts` — keybag on-disk golden (exercises `hashStringSync`/`hashStringAsync`).

## Tasks (ordered; each cuts over only when its gate is green)

### Task 1 — Audit the real `SuperThis` surface the lift needs

Before building anything, enumerate exactly what the lifted `sts-service` and `key-bag.ts` read off `sthis`. Output: a precise interface that the in-repo runtime context must provide. This de-risks Task 4 (the `ensureSuperThis` replacement) by pinning its contract first. No code change — a findings note appended to this plan.

**Findings (done — audited against the branch).** Every `sthis.<member>` access across identity source (non-test), by frequency:

| Member               | Count | Notes                                                |
| -------------------- | ----- | ---------------------------------------------------- |
| `sthis.txt.base64`   | 4     | base64 codec (JWT/cert encoding)                     |
| `sthis.nextId`       | 4     | id generation (already in `RuntimeContext`)          |
| `sthis.env.get`      | 4     | env read (`DEVICE_ID_*`, `CLOUD_SESSION_*`)          |
| `sthis.txt.decode`   | 3     | utf8 decode                                          |
| `sthis.env.set`      | 3     | env **mutation** — beyond read-only `RuntimeContext` |
| `sthis.txt.encode`   | 2     | utf8 encode                                          |
| `sthis.start`        | 2     | lifecycle `start()` — context must expose it         |
| `sthis.env.gets`     | 2     | batched env read                                     |
| `sthis.pathOps.join` | 1     | keybag file-path join — **`pathOps`** needed (node)  |
| `sthis.logger`       | 1     | logger handle                                        |
| `sthis.env.delete`   | 1     | env mutation                                         |

So _within identity_, the in-repo context must provide more than the narrow `RuntimeContext`: full `env` (get/gets/set/delete), `txt` (base64/encode/decode), `nextId`, `logger`, `pathOps.join`, and a `start()` lifecycle. The `sts-service` signatures are `importJWK(jwk, alg, options)` (no sthis), `env2jwk(env, alg, sthis = ensureSuperThis())` (sthis defaulted — needs `env`/`txt`/crypto), `verifyToken(token, presetPubKey, wellKnownUrls, iopts)` (no sthis).

**Correction (Codex review #2841, P2) — the contract is repo-WIDE, not identity-internal.** Phase 2 routed _non-identity_ code through the facade's `ensureSuperThis` export too, so the real contract the facade must satisfy is the union of every `sthis.<member>` reached by **any** consumer of `@vibes.diy/identity`, not just identity's own files. Repo-wide audit surfaces members **beyond** the identity-internal set:

| External member             | Example consumer                                                                              | Why it matters                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `sthis.timeOrderedNextId()` | `api/svc/public/asset-upload-grant.ts:66`, `app-documents-write-eventos.ts:217` (jti / docId) | distinct from `nextId()` — a thin context lacking it breaks production grant/doc-write paths |
| `sthis.env.sets()` (batch)  | `api/svc/create-handler.ts:94`, `vibes-diy/cli/main.ts:96`                                    | distinct from `env.set`                                                                      |
| `sthis.txt.base58`          | (repo-wide)                                                                                   | distinct from `base64`                                                                       |
| `sthis.logger.Flush()`      | (repo-wide)                                                                                   | logger lifecycle                                                                             |

**Conclusion (revised).** The facade's `ensureSuperThis` cannot be repointed at a thin context — its external consumers depend on a near-complete `SuperThis` (`timeOrderedNextId`, `env.sets`, `txt.base58`, `logger.Flush`, plus the identity-internal surface). Task 4 must therefore **preserve a fully-compatible `ensureSuperThis`**, which means one of:

- **(4a) Reimplement the full `SuperThis`** (cement-backed: `envFactory`, `toCryptoRuntime`, `LoggerImpl`, `timeOrderedNextId`, all codecs) in-repo — large, and the genuine "SuperThis decision" the spec flagged; **or**
- **(4b) Keep `core-runtime`'s `ensureSuperThis`/`SuperThis` as a documented residual** behind the facade, and declare Phase 4 "done" at lifting only the _crypto_ (hashes + `sts`), with `core-runtime` retained for `SuperThis` alone (the inventory doc's "remaining uses with rationale" pattern). This still shrinks the dep to one symbol but does **not** reach literal zero `@fireproof/core-runtime`.

This decision gates whether **T5 (full dep drop) is reachable at all**; resolve it (with the human) before starting Task 4. `env2jwk`'s `ensureSuperThis()` default is repointed at whichever context results, in Task 3.

### Task 2 — Lift the pure/hash utilities in-repo (gated, but dep-drop deferred)

Create `vibes.diy/identity/runtime/hashing.ts` lifting `deepFreeze` + `hashStringSync` + `hashStringAsync` + `hashObjectSync` + `hashObjectAsync` + the `Hasher` class **verbatim** (adjusting only imports). Add `multiformats` + `@adviser/ts-xxhash` to identity's deps. Repoint `certor.ts`, `key-bag.ts`, `ca.ts`, and the `index.ts` facade hashObjectSync re-export at the in-repo module. **Gate:** extend `keybag-golden` + `identity-wire-compat` with an extracted-hash cross-check (extracted hash == fireproof hash for the same input) — both green in CI. (`core-runtime` stays; dep not dropped yet.)

### Task 3 — Lift the `sts-service` JWT/JWK crypto in-repo

Create `vibes.diy/identity/sts/` lifting the used `sts-service` surface (`env2jwk`, `importJWK`, `verifyToken` + their transitive helpers) **verbatim**. Keep `jose` calls and the JWK/JWT field layout identical. Repoint `device-id/{validator,key,verify}.ts` and `dash-api/{clerk-token,token}.ts`. **Gate:** extend `auth-token-verify-golden` + `identity-wire-compat` with extracted ⇄ fireproof cross-verification (extracted-minted verifies under fireproof and vice-versa) — both green in CI. This is the highest-risk task; do not proceed to Task 5 unless both directions pass.

### Task 4 — Resolve the `ensureSuperThis` facade contract (decision gate, then implement)

**This task starts with a decision, not code** (see the revised Task 1 conclusion): the facade `ensureSuperThis` is consumed repo-wide with a near-complete `SuperThis` surface, so it cannot become a thin context. Pick **4a (reimplement full `SuperThis` in-repo)** or **4b (retain `core-runtime` for `SuperThis` as a documented residual)** _with the human_ before writing code — it determines whether T5 is reachable.

- **If 4a:** implement `vibes.diy/identity/runtime/superthis.ts` providing the full audited surface (`env` get/gets/set/sets/delete, `txt` base64/base58/encode/decode, `nextId`, `timeOrderedNextId`, `logger` incl. `Flush`, `pathOps`, `start`, crypto runtime) on `@adviser/cement` primitives. Repoint `runtime-context.ts`, the facade `ensureSuperThis`/`ensureLogger`/`runtimeFn`, and `dash-api/token.ts`'s default. **Gate:** full api + identity suites green end-to-end.
- **If 4b:** stop here; `SuperThis`/`ensureSuperThis` stays `core-runtime`-backed, and Phase 4 ships only the crypto lift (Tasks 2–3). Document the residual in the inventory doc and **skip Task 5's dep-drop** (the dep shrinks to one symbol but doesn't leave).

### Task 5 — Drop `@fireproof/core-runtime` from identity; final sweep _(only reachable under 4a)_

**Pre-T5 consumer-surface gate (Charlie review #2841).** Before removing the dep, prove the in-repo `SuperThis` covers **every** consumer's surface — the thin-context strand-risk must be impossible, not merely audited once:

1. Regenerate the repo-wide consumer surface: `grep -rhoE "sthis\.[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?" --include=*.ts . | grep -v node_modules | sort -u` and list each distinct member + an example consumer.
2. Diff that set against the methods the in-repo `superthis.ts` actually implements. The diff **must be empty**; any member present in consumers but absent from the impl blocks T5.
3. Record the consumer list + the empty-diff result in the T5 PR description (the proof, not a claim).

Then remove `@fireproof/core-runtime` from `vibes.diy/identity/package.json`, delete/repoint the facade re-export in `index.ts`, `pnpm install`, and run the gate commands below. Confirm repo-wide: `grep -rn "@fireproof/core-runtime"` returns **zero** outside `node_modules`/lockfile. Update this plan + the inventory doc to mark Bucket E **done** and close #2468. Under **4b**, Bucket E closes with `SuperThis` documented as the single retained `core-runtime` symbol instead.

## Gate commands — what "green" means (Charlie review #2841)

"Green" is unambiguous; each task's gate is these exact commands + CI jobs, not a vibe:

| Task             | Local gate (node-capable env)                                                                                                         | CI jobs that must pass                          | Fixture expectation                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T2 (hashes)      | `cd vibes.diy/identity && pnpm vitest --run keybag-golden` **and** `cd vibes.diy/api/tests && pnpm vitest --run identity-wire-compat` | `test (1)`–`test (4)`, `compile_test`, `checks` | extracted-hash `===` fireproof-hash for the same input (new cross-check assertions); existing keybag golden bytes unchanged                                                 |
| T3 (`sts`)       | `cd vibes.diy/api/tests && pnpm vitest --run auth-token-verify-golden identity-wire-compat`                                           | `test (1)`–`test (4)`, `compile_test`, `checks` | extracted-minted token verifies under fireproof verifier **and** fireproof-minted verifies under extracted — both directions; golden token header/claim keys byte-identical |
| T4 (`SuperThis`) | `pnpm check` (full api + identity suites)                                                                                             | all of the above + `pg_concurrency`             | no test diffs; `who-am-i` / asset-grant / doc-write paths (the `timeOrderedNextId` consumers) green                                                                         |
| T5 (drop dep)    | `pnpm install && pnpm check` + the pre-T5 consumer-diff above                                                                         | full required set green                         | `grep -rn "@fireproof/core-runtime"` outside `node_modules`/lockfile = **0**                                                                                                |

## Source-lock provenance (hard per-task merge gate)

All symbols pinned at `@fireproof/core-runtime@0.24.19` (upstream tag `fireproof-storage/fireproof@v0.24.19`).

**Provenance completion is a merge gate, not a "later" (Charlie review #2841).** A lift task's PR must **not merge** until its row below is fully filled — the upstream file path, the **exact symbol line-ranges** lifted, and the resolved **`v0.24.19` commit SHA** — recorded in the PR description. An empty/`_(record at lift)_` cell on a touched row blocks merge; this is how the managed-fork sync lane tracks upstream security fixes against known source.

| Lifted symbol(s)                                                 | Upstream file (+ line range)                  | Target in-repo module         | v0.24.19 SHA       |
| ---------------------------------------------------------------- | --------------------------------------------- | ----------------------------- | ------------------ |
| `deepFreeze`, `hashString*`, `hashObject*`, `Hasher`             | `core-runtime/utils.js` _(L?–L?)_             | `identity/runtime/hashing.ts` | _(record at lift)_ |
| `sts-service` (`env2jwk`/`importJWK`/`verifyToken` + transitive) | `core-runtime/sts-service/index.js` _(L?–L?)_ | `identity/sts/`               | _(record at lift)_ |
| `ensureSuperThis`/`ensureLogger`/`runtimeFn` surface             | `core-runtime` (cement-backed) _(L?–L?)_      | `identity/runtime/context.ts` | _(record at lift)_ |

## Risk & rollback

- **Per-task revertibility:** each task is its own commit/PR; a failed gate reverts that task only, leaving the prior (still fireproof-backed) facade intact — exactly how Phases 1–3 stayed safe.
- **The dep stays until Task 5.** Until then identity is still fireproof-backed and fully working; there is no half-migrated auth state shipped.
- **If a cross-verify gate can't be made green** (a crypto detail resists verbatim lift), stop and escalate — do not ship a reimplementation on faith. The fallback is to keep `core-runtime` for that one symbol and document it as a residual (the inventory doc's "remaining uses with rationale" pattern).
