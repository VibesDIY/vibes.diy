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

So the in-repo context (Task 4) must provide **more than the narrow `RuntimeContext`**: full `env` (get/gets/set/delete), `txt` (base64/encode/decode), `nextId`, `logger`, `pathOps.join`, and a `start()` lifecycle. The `sts-service` signatures are `importJWK(jwk, alg, options)` (no sthis), `env2jwk(env, alg, sthis = ensureSuperThis())` (sthis defaulted — needs `env`/`txt`/crypto), `verifyToken(token, presetPubKey, wellKnownUrls, iopts)` (no sthis). Conclusion: the in-repo context is a **superset of `RuntimeContext`** (call it `IdentityRuntime`), and `env2jwk`'s `ensureSuperThis()` default must be repointed at it in Task 3.

### Task 2 — Lift the pure/hash utilities in-repo (gated, but dep-drop deferred)

Create `vibes.diy/identity/runtime/hashing.ts` lifting `deepFreeze` + `hashStringSync` + `hashStringAsync` + `hashObjectSync` + `hashObjectAsync` + the `Hasher` class **verbatim** (adjusting only imports). Add `multiformats` + `@adviser/ts-xxhash` to identity's deps. Repoint `certor.ts`, `key-bag.ts`, `ca.ts`, and the `index.ts` facade hashObjectSync re-export at the in-repo module. **Gate:** extend `keybag-golden` + `identity-wire-compat` with an extracted-hash cross-check (extracted hash == fireproof hash for the same input) — both green in CI. (`core-runtime` stays; dep not dropped yet.)

### Task 3 — Lift the `sts-service` JWT/JWK crypto in-repo

Create `vibes.diy/identity/sts/` lifting the used `sts-service` surface (`env2jwk`, `importJWK`, `verifyToken` + their transitive helpers) **verbatim**. Keep `jose` calls and the JWK/JWT field layout identical. Repoint `device-id/{validator,key,verify}.ts` and `dash-api/{clerk-token,token}.ts`. **Gate:** extend `auth-token-verify-golden` + `identity-wire-compat` with extracted ⇄ fireproof cross-verification (extracted-minted verifies under fireproof and vice-versa) — both green in CI. This is the highest-risk task; do not proceed to Task 5 unless both directions pass.

### Task 4 — Replace `ensureSuperThis()` with a thin in-repo `RuntimeContext`

Using Task 1's contract, implement `vibes.diy/identity/runtime/context.ts` providing exactly `env` (via `@adviser/cement` `envFactory`), `txt` codecs, `nextId`, `logger` (`LoggerImpl`), and any crypto runtime the lifted `sts`/keybag need. Repoint `runtime-context.ts`'s `ensureRuntimeContext()` and `dash-api/token.ts`'s default param at it. Keep `runtimeFn`/`ensureLogger` behavior. **Gate:** full api + identity suites green (the "no forced re-login" gate end-to-end).

### Task 5 — Drop `@fireproof/core-runtime` from identity; final sweep

Once Tasks 2–4 route every identity import in-repo, remove `@fireproof/core-runtime` from `vibes.diy/identity/package.json`, delete the facade re-export in `index.ts` (or repoint it in-repo), `pnpm install`, and run the full check + all three golden harnesses. Confirm repo-wide: `grep -rn "@fireproof/core-runtime"` returns **zero** outside `node_modules`/lockfile. Update this plan + the inventory doc to mark Bucket E **done** and close #2468.

## Source-lock provenance (fill at lift time)

All symbols pinned at `@fireproof/core-runtime@0.24.19` (upstream tag `fireproof-storage/fireproof@v0.24.19`).

| Lifted symbol(s)                                                 | Upstream file                       | Target in-repo module         | v0.24.19 SHA       |
| ---------------------------------------------------------------- | ----------------------------------- | ----------------------------- | ------------------ |
| `deepFreeze`, `hashString*`, `hashObject*`, `Hasher`             | `core-runtime/utils.js`             | `identity/runtime/hashing.ts` | _(record at lift)_ |
| `sts-service` (`env2jwk`/`importJWK`/`verifyToken` + transitive) | `core-runtime/sts-service/index.js` | `identity/sts/`               | _(record at lift)_ |
| `ensureSuperThis`/`ensureLogger`/`runtimeFn` surface             | `core-runtime` (cement-backed)      | `identity/runtime/context.ts` | _(record at lift)_ |

## Risk & rollback

- **Per-task revertibility:** each task is its own commit/PR; a failed gate reverts that task only, leaving the prior (still fireproof-backed) facade intact — exactly how Phases 1–3 stayed safe.
- **The dep stays until Task 5.** Until then identity is still fireproof-backed and fully working; there is no half-migrated auth state shipped.
- **If a cross-verify gate can't be made green** (a crypto detail resists verbatim lift), stop and escalate — do not ship a reimplementation on faith. The fallback is to keep `core-runtime` for that one symbol and document it as a residual (the inventory doc's "remaining uses with rationale" pattern).
