# De-fireproof — Identity Runtime Extraction (Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `@fireproof/*` runtime _internals_ still backing `@vibes.diy/identity` (device-id signer/key, keybag, CSR→cert CA + verify, and the Clerk dashboard client) with in-repo implementations, gated by a byte-level wire-compat harness, so the `@fireproof/*` runtime dependencies and the `core-types-base` patch can be dropped — without changing a single call site or forcing any user to re-login.

**Architecture:** Plan 1 (foundation) already landed the **encapsulation boundary**: every identity-relevant import in source routes through `@vibes.diy/identity` (`.` browser / `./server` worker / `./node` Node-CLI), the three duplicated device-id signers are DRY'd behind `createDeviceIdGetToken()`, and a golden wire-compat harness pins the current contract. The package is still **fireproof-backed internally** — its facade modules `export { … } from "@fireproof/*"`. This plan swaps those internals behind the _unchanged_ facade surface. Per the spec's ratified resolution (Q2): **lift-verbatim** the cert/CSR/token sign+verify crypto (a deployed wire format — do not risk a reimplementation drift), reimplement only provably-standard primitives (HKDF) behind compat tests. Every cutover is gated by extending the existing harness with **cross-verification** (extracted-mints ⇄ fireproof-verifies) before the fireproof backing is removed.

**Tech Stack:** TypeScript, Vitest 4, pnpm workspaces, `@adviser/cement` (Result/Option/Lazy — explicitly _not_ a removal target), `jose` (ES256, already a dep via `hkdf-key.ts`), WebCrypto. Source under extraction: `@fireproof/core-device-id`, `@fireproof/core-keybag`, `@fireproof/core-protocols-dashboard`, `@fireproof/core-types-*`.

**Scope note — what this plan deliberately excludes:**

- **Bucket C (login localhost server / #1616)** — already shipped; `node.ts` re-exports `deviceIdRegisterEvento`/`isResDeviceIdRegister` and the styled `/cert` page landed. Not re-touched here.
- **Bucket D (legacy in-browser IndexedDB — `use-fireproof` in `ImgGen.tsx` / `use-img-gen.ts`)** — **out of scope** per the design's ratified resolution (Q5): it is a separate firefly-migration track with its own acceptance criteria, _not_ part of the identity/PKI extraction. Excluded.
- **Bucket E (`SuperThis` / `ensureSuperThis` narrowing)** — separate plan, tracked in [#2468](https://github.com/VibesDIY/vibes.diy/issues/2468). This plan keeps using the existing `RuntimeContext` seam unchanged.
- **Bucket F (`@fireproof/core-cli` build tool)** — separate plan, tracked in [#2483](https://github.com/VibesDIY/vibes.diy/issues/2483). The `cli-kit.ts` runtime-framework internals swap is [#2482](https://github.com/VibesDIY/vibes.diy/issues/2482); browser-graph hardening is [#2469](https://github.com/VibesDIY/vibes.diy/issues/2469).

**Source-of-truth references:**

- Design spec: [`docs/superpowers/specs/2026-06-19-defireproof-identity-extraction-design.md`](../specs/2026-06-19-defireproof-identity-extraction-design.md) (APPROVED; Buckets A–F; resolutions Q1–Q6).
- Foundation plan (predecessor, landed): [`docs/superpowers/plans/2026-06-19-defireproof-identity-extraction-foundation.md`](2026-06-19-defireproof-identity-extraction-foundation.md). This plan is its **"Plan 3 — Identity runtime extraction"** roadmap item, folded together with the residual **Plan 2 — Type ownership** (Bucket B), because the wire-types and the verifier that consumes the patch cut over together.

---

## Background facts (verified against the current branch)

- **The facade still imports fireproof at runtime.** `vibes.diy/identity/index.ts` does `export { ensureSuperThis, ensureLogger, runtimeFn, hashObjectSync, sts } from "@fireproof/core-runtime"`, `export { JWKPrivateSchema } from "@fireproof/core-types-base"`, `export { ClerkApiToken, clerkDashApi, DashboardApiImpl } from "@fireproof/core-protocols-dashboard"`, plus type-only re-exports from `core-types-protocols-dashboard`, `core-types-base`, `core-types-device-id`. `vibes.diy/identity/node.ts` does `export { getKeyBag } from "@fireproof/core-keybag"` and `export { DeviceIdKey, DeviceIdSignMsg, DeviceIdCSR, DeviceIdCA } from "@fireproof/core-device-id"`. These re-exported **values** are what still pin the dependency.
- **The single owned signer already exists.** `createDeviceIdGetToken(sthis, { iss, missingCertMessage })` in `vibes.diy/identity/node.ts` is the DRY'd implementation; its three callers already import it: `vibes-diy/cli/main.ts:44`, `use-vibes/base/firefly-defaults.node.ts:18`, and the eval harness. **No call site changes in this plan** — only the symbols `createDeviceIdGetToken` references internally change backing.
- **The patch is load-bearing in two places.** `patches/@fireproof__core-types-base@0.24.19.patch` adds `.catch()` defaults to `ClerkClaimSchema`. Our copy already lives in `vibes.diy/identity/clerk-claim.ts` (the phase-1 parity artifact). The upstream patch _also_ relaxes fireproof's internal `tokenApi.verify` (`core-protocols-dashboard/token.js` imports the upstream schema), so the patch is droppable **only after** our extracted verifier replaces fireproof's `tokenApi` — which is Task 5 of this plan.
- **The golden harness exists** at `vibes.diy/api/tests/identity-wire-compat.test.ts` and currently pins the baseline (header `{alg:ES256,typ:JWT,kid,x5c,x5t,x5t#S256}`; payload `FPDeviceIDSession` keys `{deviceId,exp,iat,iss,jti,nbf,seq,sub}`; verify via `new DeviceIdVerifyMsg(sthis.txt.base64,[caCert],{clockTolerance,deviceIdCA}).verifyWithCertificate(jwt)` returning a `{valid,payload,header}` discriminated union). It deps `@fireproof/core-device-id`, `core-runtime`, `core-types-base`, `core-types-device-id`, `@adviser/cement`; runner `vitest --run`.
- **Server CA / verify call sites** to re-home: `vibes.diy/api/svc/public/get-cert-from-csr.ts` (`DeviceIdCA.processCSR`), `vibes.diy/api/svc/create-handler.ts:143-149` (CA from env + `tokenApi[type].verify`), `vibes.diy/api/svc/check-auth.ts` (verify result shapes), `vibes.diy/api/svc/types.ts:37` (`DeviceIdCAIf`).
- **Clerk runtime client** call sites: `vibes.diy/api/impl/index.ts:169,301` (`new ClerkApiToken(sthis)`), `use-vibes/base/contexts/VibeContext.tsx:4,69,98` (`clerkDashApi`/`DashboardApiImpl`).
- **Wire-compat hard constraints (release gate, from spec §"Wire-compatibility constraints"):** existing device certs in `~/.fireproof/keybag` keep validating (no forced re-login); deployed `DEVICE_ID_CA_*` / `CLOUD_SESSION_TOKEN_*` env material keeps working unchanged; `device-id` ES256 + Clerk token verification stays bit-identical; `VIBES_DEVICE_ID` headless-auth seeding keeps accepting existing keybag-file payloads.

## File Structure

New in-repo implementation modules (all under `vibes.diy/identity/`, the single owner):

- `vibes.diy/identity/device-id/key.ts` — ES256 P-256 key: load-from-JWK, export, public key, `fingerPrint()`. In-repo equivalent of `DeviceIdKey`. Responsibility: device key material only.
- `vibes.diy/identity/device-id/sign.ts` — `DeviceIdSignMsg`: sign an `FPDeviceIDSession` claim set as an ES256 JWT with the cert-chain headers (`kid/x5c/x5t/x5t#S256`). Responsibility: client token minting.
- `vibes.diy/identity/device-id/csr.ts` — `DeviceIdCSR`: build a CSR JWS. Responsibility: enrollment request shape.
- `vibes.diy/identity/device-id/verify.ts` — `DeviceIdVerifyMsg`: `verifyWithCertificate(jwt)` → `{valid,payload,header,…}` union. Responsibility: server-side device-token verification against the CA chain.
- `vibes.diy/identity/ca/device-ca.ts` — `DeviceIdCA`: `processCSR(csrJWS, clerkClaim)` issues a cert; `caCertificate()`; `getCAKey()`; env loader (`deviceIdCAFromEnv`, `getCloudPubkeyFromEnv`). Responsibility: server CA.
- `vibes.diy/identity/keybag/keybag.ts` — `getKeyBag(sthis)` reading/writing `~/.fireproof/keybag/<id>.json` (`.getDeviceId()`/`.setDeviceId()`). Node-only (`fs`/`find-up`). Responsibility: local device keystore.
- `vibes.diy/identity/dash-api/clerk-token.ts` — `ClerkApiToken` (server signer/verifier) + the `tokenApi` dispatch that consumes `ClerkClaimSchema`. Responsibility: Clerk token sign/verify.
- `vibes.diy/identity/dash-api/dash-client.ts` — `clerkDashApi` / `DashboardApiImpl` (browser dashboard client). Responsibility: browser-side Clerk dashboard API.
- `vibes.diy/identity/types/wire.ts` — in-repo definitions of the Bucket B wire-types (`DashAuthType`, `FPDeviceIDSession`, `ReqCertFromCsr`, `ResCertFromCsr`, `VerifiedAuthResult`, `VerifiedClaimsResult`, `VerifiedResult`, `WithAuth`, `JWKPrivate`, `JWKPrivateSchema`, `DeviceIdKeyBagItem`, `DeviceIdResult`, `DeviceIdCAIf`, `FPApiParameters`, `FPApiToken`). Responsibility: own the auth wire-format so `core-types-*` leaves source.

Modified (facade re-points; **public surface unchanged**):

- `vibes.diy/identity/index.ts`, `vibes.diy/identity/node.ts`, `vibes.diy/identity/server.ts` — swap each `from "@fireproof/*"` to the in-repo module.
- `vibes.diy/identity/package.json` — drop `@fireproof/*` runtime deps as each is cut over.
- `patches/@fireproof__core-types-base@0.24.19.patch` — deleted in Task 5.

Extended:

- `vibes.diy/api/tests/identity-wire-compat.test.ts` — add the cross-verification gate.

> **Exports surface (no new subpaths):** The new modules live in subdirectories for organization but are **internal** — `@vibes.diy/identity`'s `package.json` exports only `.`, `./server`, and `./node`, and this plan adds **none**. Every consumer (and the cross-package wire-compat harness) reaches the extracted classes through those three existing entrypoints; the facade modules (`index.ts`/`server.ts`/`node.ts`) re-export from the in-repo modules instead of from `@fireproof/*`. A cross-package import of `@vibes.diy/identity/device-id/*` would fail to resolve under the package's `exports` map — do not write one.

> **DRY / lift-verbatim instruction:** Per spec Q2, the crypto bodies are **lifted verbatim** from the installed `@fireproof/core-device-id` / `core-keybag` / `core-protocols-dashboard` sources (same `jose`-based ES256, same JWT header/claim layout), adjusting only import paths (`@fireproof/core-types-base` → `./types/wire.js`; `SuperThis` stays via the existing `RuntimeContext` seam). Do **not** rewrite the signing/verifying algorithm — a byte mismatch is silent auth breakage. The cross-verification harness (Task 1) is the proof obligation.

### Source-lock provenance (managed-fork discipline — spec Q6)

Each lifted symbol must record its exact upstream origin so the managed-fork sync lane can track security fixes against known source SHAs. **All packages are pinned at `0.24.19`** (the version installed in this repo); upstream tag `fireproof-storage/fireproof@v0.24.19`. As the first action of each lift task, fill the **upstream file path** and **commit SHA** columns below by reading the installed package source (`node_modules/@fireproof/<pkg>/…`) and resolving the `v0.24.19` tag's commit on the upstream repo — and keep this table updated in the PR description. The implementing agent must not leave a lifted module without a populated row (this is the provenance gate, not optional bookkeeping).

| Lifted symbol(s)                                           | Upstream package @ version                                               | Target in-repo module                          | Upstream file path     | Upstream commit SHA |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- | ---------------------- | ------------------- |
| `DeviceIdKey`                                              | `@fireproof/core-device-id@0.24.19`                                      | `vibes.diy/identity/device-id/key.ts`          | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `DeviceIdSignMsg`                                          | `@fireproof/core-device-id@0.24.19`                                      | `vibes.diy/identity/device-id/sign.ts`         | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `DeviceIdCSR`                                              | `@fireproof/core-device-id@0.24.19`                                      | `vibes.diy/identity/device-id/csr.ts`          | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `DeviceIdVerifyMsg`                                        | `@fireproof/core-device-id@0.24.19`                                      | `vibes.diy/identity/device-id/verify.ts`       | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `DeviceIdCA`, `deviceIdCAFromEnv`, `getCloudPubkeyFromEnv` | `@fireproof/core-device-id@0.24.19` / `core-protocols-dashboard@0.24.19` | `vibes.diy/identity/ca/device-ca.ts`           | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `getKeyBag`                                                | `@fireproof/core-keybag@0.24.19`                                         | `vibes.diy/identity/keybag/keybag.ts`          | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `ClerkApiToken`, `tokenApi`                                | `@fireproof/core-protocols-dashboard@0.24.19`                            | `vibes.diy/identity/dash-api/clerk-token.ts`   | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `clerkDashApi`, `DashboardApiImpl`                         | `@fireproof/core-protocols-dashboard@0.24.19`                            | `vibes.diy/identity/dash-api/dash-client.ts`   | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `JWKPrivateSchema`, `JWKPrivate`                           | `@fireproof/core-types-base@0.24.19`                                     | `vibes.diy/identity/types/wire.ts`             | _(record at lift)_     | _(v0.24.19 SHA)_    |
| `ClerkClaimSchema` (already lifted, incl. patch)           | `@fireproof/core-types-base@0.24.19` _(+ local patch)_                   | `vibes.diy/identity/clerk-claim.ts` _(exists)_ | `fp-clerk-claim.zod.*` | _(v0.24.19 SHA)_    |

---

## Task 1: Extend the golden harness with cross-verification (the gate)

This task adds the proof obligation that _every_ later cutover must keep green: a token minted by the **extracted** signer must verify under the **fireproof** verifier, and vice-versa, byte-for-byte. It is written first, against placeholder extracted factories that initially just re-call fireproof, so the harness compiles and passes before any real swap, then tightens as each module lands.

**Files:**

- Modify: `vibes.diy/api/tests/identity-wire-compat.test.ts`
- Create: `vibes.diy/api/tests/identity-extracted-factories.ts` (the swap point)

- [ ] **Step 1: Create the factory seam the harness swaps on**

Create `vibes.diy/api/tests/identity-extracted-factories.ts`. v1 delegates to fireproof so the baseline is unchanged; later tasks repoint each factory to the extracted module. This is the single edit point for cross-verification.

```ts
// The swap point for the wire-compat cross-verification harness. Each factory
// returns the IMPLEMENTATION UNDER TEST. v1 delegates to @fireproof/* so the
// harness is green before any extraction; as each @vibes.diy/identity module
// lands (Tasks 2-5), repoint the matching factory at it. When all point at the
// extracted impl and the cross-verify test stays green, the fireproof backing
// is provably equivalent and can be dropped.
import { DeviceIdKey, DeviceIdSignMsg, DeviceIdVerifyMsg } from "@fireproof/core-device-id";

export const extracted = {
  DeviceIdKey,
  DeviceIdSignMsg,
  DeviceIdVerifyMsg,
};
```

- [ ] **Step 2: Add the failing cross-verification test**

Append to `vibes.diy/api/tests/identity-wire-compat.test.ts` (inside the existing `describe`, reusing its `sthis`/`ca`/`user`/`verifier`). It mints with the _baseline_ user signer and verifies with the _extracted_ verifier, and mints with an _extracted_ signer and verifies with the _baseline_ verifier:

```ts
import { extracted } from "./identity-extracted-factories.js";

it("cross-verify: fireproof-minted token verifies under the extracted verifier", async () => {
  const tok = await user.getDashBoardToken(); // fireproof-minted
  const caCert = (await ca.caCertificate()).Ok();
  const extractedVerifier = new extracted.DeviceIdVerifyMsg(sthis.txt.base64, [caCert], {
    clockTolerance: 0,
    deviceIdCA: ca,
  });
  const vr = await extractedVerifier.verifyWithCertificate(tok.token);
  expect(vr.valid).toBe(true);
});

// Helper: issue a device cert through the PUBLIC CA path so neither the signer
// nor the verifier reads private state. `DeviceIdSignMsg` stores its cert in a
// hard-private `#cert` and exposes no `certificatePayload`/`payload` getter, so
// we must NOT reconstruct a signer from `user.deviceIdSigner`. Instead mirror
// what `createTestUser` does internally: build a CSR and issue a cert via the
// CA, then read the public `certificatePayload` off the issuance result (the
// same field `node.ts`'s `createDeviceIdGetToken` reads from the keybag cert).
// The ONLY contract this test pins is the verified `ca.processCSR(csrJWS,
// clerkClaim)` → `{ certificatePayload }`; the `DeviceIdCSR` construction below
// mirrors the installed `createTestUser` helper — match its exact call when you
// implement (it is already imported in the harness).
async function issueDeviceCert(sthisArg: SuperThis, caArg: typeof ca) {
  const key = (await DeviceIdKey.create()).Ok();
  const csr = await DeviceIdCSR.create(sthisArg, key, { session: "wire-compat" });
  const clerkClaim = {
    role: "member",
    sub: "u_wirecompat",
    userId: "u_wirecompat",
    params: { email: "wire@compat.test", email_verified: true, public_meta: {} },
  };
  const cert = (await caArg.processCSR(await csr.asJWS(), clerkClaim)).Ok();
  return { key, certPayload: cert.certificatePayload };
}

it("cross-verify: extracted-minted token verifies under the fireproof verifier (byte-identical header+claims)", async () => {
  // Mint with the EXTRACTED signer, built from a publicly-issued cert (never
  // from createTestUser's private `#cert`).
  const { key, certPayload } = await issueDeviceCert(sthis, ca);
  const signer = new extracted.DeviceIdSignMsg(sthis.txt.base64, key, certPayload);
  const now = Math.floor(Date.now() / 1000);
  const token = await signer.sign(
    {
      iss: "wire-compat",
      sub: "device-id",
      deviceId: await key.fingerPrint(),
      seq: 1,
      exp: now + 120,
      nbf: now - 2,
      iat: now,
      jti: sthis.nextId().str,
    },
    "ES256"
  );
  const vr = await verifier.verifyWithCertificate(token); // fireproof verifier
  expect(vr.valid).toBe(true);
  const header = decodeSeg(token.split(".")[0]);
  expect(header.alg).toBe("ES256");
  for (const k of ["kid", "x5c", "x5t", "x5t#S256"]) expect(header).toHaveProperty(k);
  const payload = decodeSeg(token.split(".")[1]);
  expect(Object.keys(payload).sort()).toEqual(SESSION_CLAIM_KEYS);
});
```

- [ ] **Step 3: Run it — confirm green against the baseline (factories still delegate to fireproof)**

Run: `cd vibes.diy/api/tests && pnpm vitest --run identity-wire-compat`
Expected: PASS (both cross-verify tests green — the extracted factories _are_ the fireproof ones in v1, so this just proves the harness mechanism works).

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/tests/identity-wire-compat.test.ts vibes.diy/api/tests/identity-extracted-factories.ts
git commit -m "test(identity): add wire-compat cross-verification seam (extracted ⇄ fireproof)"
```

---

## Task 2: Lift the device-id client crypto (key + sign + csr) in-repo

**Files:**

- Create: `vibes.diy/identity/device-id/key.ts`, `vibes.diy/identity/device-id/sign.ts`, `vibes.diy/identity/device-id/csr.ts`
- Modify: `vibes.diy/identity/package.json` (add `jose`), `vibes.diy/api/tests/identity-extracted-factories.ts`

- [ ] **Step 1: Lift `DeviceIdKey` verbatim**

Create `vibes.diy/identity/device-id/key.ts` by copying the `DeviceIdKey` class from the installed `@fireproof/core-device-id` source (the ES256 P-256 implementation: `create()`, `createFromJWK(jwk)`, `exportPrivateJWK()`, `publicKey()`, `fingerPrint()`). Adjust **only** imports: any `@fireproof/core-types-base` type → `../types/wire.js` (created in Task 4; until then keep the upstream type import and tighten in Task 4); keep `jose`/WebCrypto calls identical. Preserve every method name and return type (`Result<DeviceIdKey>` from `createFromJWK`) exactly — call sites in `node.ts` depend on `.createFromJWK(...).isErr()/.Ok()`.

- [ ] **Step 2: Lift `DeviceIdSignMsg` verbatim**

Create `vibes.diy/identity/device-id/sign.ts` by copying `DeviceIdSignMsg` (constructor `(base64codec, deviceIdKey, certificatePayload)`, `.sign(session, "ES256")` producing the `kid/x5c/x5t/x5t#S256` header). Keep the JWT header field order and the `x5c` chain encoding **identical** — this is the byte-compat surface. Adjust only imports.

- [ ] **Step 3: Lift `DeviceIdCSR` verbatim**

Create `vibes.diy/identity/device-id/csr.ts` by copying `DeviceIdCSR` (CSR JWS builder). Adjust only imports.

- [ ] **Step 4: Add `jose` to the identity package**

In `vibes.diy/identity/package.json` `dependencies`, add `"jose"` at the version already resolved in the repo (match `vibes.diy/api/svc`'s `jose` range — read it from `vibes.diy/api/svc/package.json` and copy that exact range). Do **not** remove any `@fireproof/*` dep yet.

- [ ] **Step 5: Surface the lifted modules through `./node`, then repoint the factories**

The `@vibes.diy/identity` `package.json` only exports `.`, `./server`, and `./node` — there is **no** `./device-id/*` subpath, and the cross-package harness (`vibes.diy/api/tests`) cannot use a relative import. So the harness must reach the extracted classes through an **exported** subpath. `node.ts` already re-exports `DeviceIdKey`/`DeviceIdSignMsg` (currently from `@fireproof/core-device-id`); repoint _those_ re-exports at the in-repo modules so `./node` now surfaces the extracted impl:

In `vibes.diy/identity/node.ts`, split the grouped re-export and point the lifted classes in-repo:

```ts
// Lifted in Task 2 — surfaced through the existing ./node export (no new subpath):
export { DeviceIdKey } from "./device-id/key.js";
export { DeviceIdSignMsg } from "./device-id/sign.js";
export { DeviceIdCSR } from "./device-id/csr.js";
// Still fireproof-backed until later tasks:
export { DeviceIdCA } from "@fireproof/core-device-id";
```

Then in `vibes.diy/api/tests/identity-extracted-factories.ts`:

```ts
import { DeviceIdKey, DeviceIdSignMsg } from "@vibes.diy/identity/node";
import { DeviceIdVerifyMsg } from "@fireproof/core-device-id"; // still fireproof until Task 3
```

(Leave `DeviceIdVerifyMsg` on fireproof — Task 3 lifts it. The harness's `DeviceIdCSR`/`createTestDeviceCA`/`createTestUser` baseline imports stay on `@fireproof/core-device-id` — they generate the comparison fixtures.)

- [ ] **Step 6: Run the harness — extracted mints must verify under fireproof**

Run: `cd vibes.diy/api/tests && pnpm vitest --run identity-wire-compat`
Expected: PASS. The "extracted-minted token verifies under the fireproof verifier" test now exercises the **real** lifted signer against fireproof's verifier — this is the byte-compat proof for client minting.

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/identity/device-id/ vibes.diy/identity/package.json vibes.diy/api/tests/identity-extracted-factories.ts
git commit -m "feat(identity): lift device-id key/sign/csr crypto in-repo (verified against fireproof verifier)"
```

---

## Task 3: Lift the device-id verifier + server CA in-repo

**Files:**

- Create: `vibes.diy/identity/device-id/verify.ts`, `vibes.diy/identity/ca/device-ca.ts`
- Modify: `vibes.diy/api/tests/identity-extracted-factories.ts`

- [ ] **Step 1: Lift `DeviceIdVerifyMsg` verbatim**

Create `vibes.diy/identity/device-id/verify.ts` by copying `DeviceIdVerifyMsg` (constructor `(base64codec, caCertResults[], { clockTolerance, deviceIdCA })`, `.verifyWithCertificate(jwt)` returning the `{ valid: true, payload, header, certificate, verificationTimestamp } | { valid: false, error, errorCode }` union — narrow on `vr.valid`). Adjust only imports.

- [ ] **Step 2: Lift `DeviceIdCA` + env loaders verbatim**

Create `vibes.diy/identity/ca/device-ca.ts` by copying `DeviceIdCA` (`processCSR(csrJWS, clerkClaim)`, `caCertificate()`, `getCAKey()`) and the env helpers `deviceIdCAFromEnv` / `getCloudPubkeyFromEnv` from the installed `core-device-id` / `core-protocols-dashboard` sources. Keep the env variable names (`DEVICE_ID_CA_*`, `CLOUD_SESSION_TOKEN_*`) and the cert payload layout **identical** — deployed CA material must keep working unchanged.

- [ ] **Step 3: Surface the verifier through `./node`, then repoint the factory**

In `vibes.diy/identity/node.ts`, add the verifier + CA re-exports pointing in-repo (same "no new subpath" rule as Task 2 Step 5):

```ts
export { DeviceIdVerifyMsg } from "./device-id/verify.js";
export { DeviceIdCA } from "./ca/device-ca.js"; // replaces the fireproof DeviceIdCA re-export
```

Then in `vibes.diy/api/tests/identity-extracted-factories.ts`:

```ts
import { DeviceIdVerifyMsg } from "@vibes.diy/identity/node";
```

- [ ] **Step 4: Run the harness — full extracted ⇄ fireproof cross-verification**

Run: `cd vibes.diy/api/tests && pnpm vitest --run identity-wire-compat`
Expected: PASS. Now _both_ directions use the extracted impl on one side and fireproof on the other — the complete byte-compat gate for device-id tokens. If either direction fails, a crypto detail drifted during the lift; do not proceed.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/identity/device-id/verify.ts vibes.diy/identity/ca/ vibes.diy/api/tests/identity-extracted-factories.ts
git commit -m "feat(identity): lift device-id verifier + server CA in-repo (cross-verified vs fireproof)"
```

---

## Task 4: Own the Bucket B wire-types in-repo

**Files:**

- Create: `vibes.diy/identity/types/wire.ts`
- Modify: `vibes.diy/identity/index.ts`, `vibes.diy/identity/server.ts`, `vibes.diy/identity/node.ts`, and the device-id/ca modules' imports

- [ ] **Step 1: Define the wire-types in-repo**

Create `vibes.diy/identity/types/wire.ts` defining each Bucket B symbol the facade currently re-exports from `core-types-*`. Most are erasable interfaces/unions; reproduce them from the installed `@fireproof/core-types-protocols-dashboard` / `core-types-base` `.d.ts` shapes verbatim. The two that carry runtime values are `JWKPrivateSchema` (zod) and the `DeviceIdResult`/`DeviceIdKeyBagItem` shapes used by the keybag. Concretely own:

```ts
// In-repo home for the auth wire-format. Erasable types are reproduced from the
// installed @fireproof/core-types-* .d.ts; JWKPrivateSchema carries the only
// runtime value (zod), lifted from core-types-base.
import { z } from "zod";

export type DashAuthType =
  | { readonly type: "device-id"; readonly token: string }
  | { readonly type: "clerk"; readonly token: string };

export interface FPDeviceIDSession {
  readonly iss: string;
  readonly sub: "device-id";
  readonly deviceId: string;
  readonly seq: number;
  readonly exp: number;
  readonly nbf: number;
  readonly iat: number;
  readonly jti: string;
}

// Reproduce verbatim from core-types-base's JWKPrivate zod schema.
export const JWKPrivateSchema = z.object({
  kty: z.string(),
  crv: z.string(),
  x: z.string(),
  y: z.string(),
  d: z.string(),
  // ...copy any remaining fields from the installed core-types-base source...
});
export type JWKPrivate = z.infer<typeof JWKPrivateSchema>;

// ReqCertFromCsr, ResCertFromCsr, VerifiedAuthResult, VerifiedClaimsResult,
// VerifiedResult, WithAuth, DeviceIdKeyBagItem, DeviceIdResult, DeviceIdCAIf,
// FPApiParameters, FPApiToken — copy each interface/union verbatim from the
// installed core-types-protocols-dashboard / core-types-base / core-types-device-id .d.ts.
```

> Reproduce the remaining type bodies from the installed `.d.ts` exactly; they are type-only and erase at build. `JWKPrivateSchema` is the parity artifact — verify it against the same fixtures the keybag reads (Step 3).

- [ ] **Step 2: Repoint the facades' type + `JWKPrivateSchema` re-exports**

In `vibes.diy/identity/index.ts`, replace the `export type { … } from "@fireproof/core-types-protocols-dashboard"`, `export type { … } from "@fireproof/core-types-base"`, `export type { DeviceIdCAIf } from "@fireproof/core-types-device-id"`, and `export { JWKPrivateSchema } from "@fireproof/core-types-base"` lines with re-exports from `./types/wire.js`. Do the same for any `core-types-*` import in `node.ts`/`server.ts` and in the device-id/ca modules from Tasks 2–3. **Keep `SuperThis` on `core-runtime`/`core-types-base` for now** — it is Bucket E (#2468), out of scope.

- [ ] **Step 3: Add a JWKPrivate parity test**

Create `vibes.diy/identity/types/wire.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { JWKPrivateSchema } from "./wire.js";

describe("JWKPrivateSchema parity", () => {
  it("accepts a real exported device JWK", () => {
    const jwk = { kty: "EC", crv: "P-256", x: "abc", y: "def", d: "ghi" };
    expect(JWKPrivateSchema.safeParse(jwk).success).toBe(true);
  });
});
```

- [ ] **Step 4: Typecheck the whole monorepo + run identity tests**

Run: `cd vibes.diy/identity && pnpm vitest --run` then `pnpm build` at repo root.
Expected: PASS / clean typecheck. Any error means a wire-type shape diverged from upstream — fix the definition in `wire.ts` to match.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/identity/types/ vibes.diy/identity/index.ts vibes.diy/identity/node.ts vibes.diy/identity/server.ts
git commit -m "feat(identity): own auth wire-types in-repo; drop core-types-* re-exports"
```

> **Bucket B is not "done" at this task's exit.** Task 4 re-homes the wire-type _declarations_, but the `core-types-base` patch (and thus the type/verify coupling it carries) can only be retired once the **extracted verifier replaces fireproof's `tokenApi`** and the patch-removal gates in **Task 5 (Steps 5–7)** pass green. Treat Bucket B as complete only after Task 5, not here.

---

## Task 5: Lift the Clerk token verifier + dashboard client; drop the patch

This is where the `core-types-base` patch becomes removable: once our verifier (not fireproof's `tokenApi`) validates Clerk tokens through our already-owned `ClerkClaimSchema`, the upstream patch's second use site (fireproof's internal `tokenApi.verify`) is no longer on our path.

**Files:**

- Create: `vibes.diy/identity/dash-api/clerk-token.ts`, `vibes.diy/identity/dash-api/dash-client.ts`
- Modify: `vibes.diy/identity/index.ts`, `vibes.diy/identity/server.ts`
- Delete: `patches/@fireproof__core-types-base@0.24.19.patch`
- Modify: root `package.json` (`pnpm.patchedDependencies`)

- [ ] **Step 1: Lift `ClerkApiToken` + `tokenApi` verbatim, wired to the owned `ClerkClaimSchema`**

Create `vibes.diy/identity/dash-api/clerk-token.ts` by copying `ClerkApiToken` and the `tokenApi` verify/sign dispatch from `@fireproof/core-protocols-dashboard`. Change its claim-validation import to `../clerk-claim.js` (our `ClerkClaimSchema`, which already carries the `.catch()` parity). Keep ES256 sign/verify identical.

- [ ] **Step 2: Lift the browser dashboard client verbatim**

Create `vibes.diy/identity/dash-api/dash-client.ts` by copying `clerkDashApi` and `DashboardApiImpl`. Adjust only imports.

- [ ] **Step 3: Repoint the facade**

In `vibes.diy/identity/index.ts`, change `export { ClerkApiToken, clerkDashApi, DashboardApiImpl } from "@fireproof/core-protocols-dashboard"` to re-export from `./dash-api/clerk-token.js` and `./dash-api/dash-client.js`. Update `server.ts` similarly (it re-exports `core-protocols-dashboard` for the worker CA/token path).

- [ ] **Step 4: Add a Clerk verify cross-compat test (incl. an explicit fireproof↔extracted token cross-check)**

Create `vibes.diy/identity/dash-api/clerk-token.test.ts`. It must do **three** things: (a) the claim-parity check (real Clerk JWT omitting `first`/`image_url`/`last`/`name` is accepted via the `.catch()` parity the patch provided); (b) **extracted→fireproof**: a token signed by the _extracted_ `ClerkApiToken` verifies under the _fireproof_ `ClerkApiToken`; (c) **fireproof→extracted**: a token signed by the _fireproof_ `ClerkApiToken` verifies under the _extracted_ one. Mint and verify with the **same** env key material on both sides so the cross-check proves byte-compat, not just self-consistency — mirroring the device-id cross-verification gate (Task 1).

```ts
import { describe, it, expect } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { ClerkApiToken as FpClerkApiToken } from "@fireproof/core-protocols-dashboard";
import { ClerkApiToken as ExtractedClerkApiToken } from "./clerk-token.js";
import { ClerkClaimSchema } from "../clerk-claim.js";

const sthis = ensureSuperThis();
const claim = {
  role: "member",
  sub: "u_1",
  userId: "u_1",
  params: { email: "a@b.c", email_verified: true, public_meta: {} },
};

describe("clerk claim parity (patch behavior owned in-repo)", () => {
  it("accepts a Clerk JWT missing the optional profile fields", () => {
    expect(ClerkClaimSchema.safeParse(claim).success).toBe(true);
  });
});

describe("clerk token cross-compat (extracted ⇄ fireproof, shared key material)", () => {
  it("extracted-signed token verifies under the fireproof verifier", async () => {
    const token = await new ExtractedClerkApiToken(sthis).sign(claim);
    const vr = await new FpClerkApiToken(sthis).verify(token);
    expect(vr.isOk?.() ?? vr.valid ?? !!vr).toBeTruthy();
  });

  it("fireproof-signed token verifies under the extracted verifier", async () => {
    const token = await new FpClerkApiToken(sthis).sign(claim);
    const vr = await new ExtractedClerkApiToken(sthis).verify(token);
    expect(vr.isOk?.() ?? vr.valid ?? !!vr).toBeTruthy();
  });
});
```

> Adjust `.sign(...)`/`.verify(...)` to `ClerkApiToken`'s exact installed signature when implementing (it reads the same `CLOUD_SESSION_TOKEN_*` env material on both sides). The `vr.isOk?.() ?? vr.valid ?? !!vr` shim tolerates whichever result shape the installed version returns; tighten it to the real shape once known.

- [ ] **Step 5: Run the API auth suite — verify nothing re-logs-in**

Run: `cd vibes.diy/api/tests && pnpm vitest --run` (covers `check-auth`, cert-from-csr, token verify against fixtures).
Expected: PASS. This is the "no forced re-login" gate for the Clerk + device-id verify paths.

- [ ] **Step 6: Delete the patch and its registration**

```bash
git rm patches/@fireproof__core-types-base@0.24.19.patch
```

In root `package.json`, remove the `"@fireproof/core-types-base@0.24.19": "patches/@fireproof__core-types-base@0.24.19.patch"` line from `pnpm.patchedDependencies`. Then:

Run: `pnpm install`
Expected: install succeeds with no "patch not applied" error and the patch gone.

- [ ] **Step 7: Run the full check**

Run: `pnpm check`
Expected: format + build + test + lint all green. (Per `agents/flaky-tests.md`, rerun once before treating any failure as real.)

- [ ] **Step 8: Commit**

```bash
git add vibes.diy/identity/dash-api/ vibes.diy/identity/index.ts vibes.diy/identity/server.ts package.json
git commit -m "feat(identity): own Clerk token verifier + dashboard client; drop core-types-base patch"
```

---

## Task 6: Remove the `@fireproof/*` runtime deps from the identity package + repoint `core-runtime`

After Tasks 2–5, nothing in `@vibes.diy/identity` imports `@fireproof/core-device-id`, `core-keybag`, `core-protocols-dashboard`, or `core-types-*` for **values** — except the `core-runtime` context helpers (`ensureSuperThis`, etc.), which stay until Bucket E (#2468). This task lifts the keybag (the last device-id value dep) and removes every now-unused `@fireproof/*` dependency declaration.

**Files:**

- Create: `vibes.diy/identity/keybag/keybag.ts`
- Modify: `vibes.diy/identity/node.ts`, `vibes.diy/identity/package.json`

- [ ] **Step 1: Lift `getKeyBag` verbatim**

Create `vibes.diy/identity/keybag/keybag.ts` by copying `getKeyBag` from `@fireproof/core-keybag` (reads/writes `~/.fireproof/keybag/<id>.json`; `.getDeviceId()`/`.setDeviceId()`). **Keep the `~/.fireproof/keybag` path and the on-disk JSON layout identical** (spec Q3 resolution: no silent relocation). It uses `find-up` — keep that; the browser-graph boundary is #2469, not this plan.

- [ ] **Step 2: Repoint `node.ts`**

In `vibes.diy/identity/node.ts`, change `export { getKeyBag } from "@fireproof/core-keybag"` and `export { DeviceIdKey, DeviceIdSignMsg, DeviceIdCSR, DeviceIdCA } from "@fireproof/core-device-id"` to re-export from the in-repo modules (`./keybag/keybag.js`, `./device-id/*.js`, `./ca/device-ca.js`). Update the internal `createDeviceIdGetToken` body's imports of `getKeyBag`/`DeviceIdKey`/`DeviceIdSignMsg` to the in-repo modules. **The exported function signature and behavior are unchanged** — its three callers are untouched.

- [ ] **Step 3: Repoint the harness factories' `createTestDeviceCA`/`createTestUser`**

These test helpers come from `@fireproof/core-device-id`. Keep them on fireproof (they generate the _baseline_ fixtures the cross-verify test compares against — that is the point). No change. Confirm the harness still imports them from `@fireproof/core-device-id`.

- [ ] **Step 4: Drop the dead deps**

From `vibes.diy/identity/package.json` `dependencies`, remove `@fireproof/core-keybag`, `@fireproof/core-device-id`, `@fireproof/core-protocols-dashboard`, `@fireproof/core-types-base`, `@fireproof/core-types-protocols-dashboard`, `@fireproof/core-types-device-id` **if and only if** no remaining `import … from` references them (grep first). **Keep** `@fireproof/core-runtime` (Bucket E) and `@fireproof/core-cli` devDep (Bucket F).

```bash
grep -rn "@fireproof/core-keybag\|@fireproof/core-device-id\|@fireproof/core-protocols-dashboard\|@fireproof/core-types" vibes.diy/identity --include=*.ts
```

Expected: only `core-runtime` and (in comments) historical mentions remain. Remove each dep with zero hits.

- [ ] **Step 5: Reinstall + full check**

Run: `pnpm install && pnpm check`
Expected: green. The identity package now backs device-id/keybag/CA/Clerk on in-repo code; only `core-runtime` (`SuperThis`) and the `core-cli` build tool remain.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/identity/keybag/ vibes.diy/identity/node.ts vibes.diy/identity/package.json
git commit -m "feat(identity): lift keybag in-repo; drop device-id/keybag/dash/types @fireproof deps"
```

---

## Task 7: Repo-wide dependency sweep + final verification

**Files:**

- Modify: any of the 27 `package.json` files still declaring a now-unused `@fireproof/*` dep (device-id/keybag/protocols-dashboard/types-\*), where the only importer was routed through `@vibes.diy/identity`.

- [ ] **Step 1: Inventory remaining `@fireproof/*` declarations**

```bash
grep -rn "@fireproof/" --include=package.json . | grep -v node_modules
```

Categorize each: (a) `core-runtime` / `core-types-base` `SuperThis` → keep (Bucket E #2468); (b) `core-cli` → keep (Bucket F #2483); (c) `use-fireproof` in `vibes.diy/base` / `tests/app` → keep (Bucket D, out of scope); (d) device-id/keybag/protocols-dashboard/types-protocols-dashboard/types-device-id whose only importer was the identity facade → **removable**.

- [ ] **Step 2: Remove category (d) declarations package-by-package**

For each package in category (d), grep its source for a direct `@fireproof/<that pkg>` import. If the only path was via `@vibes.diy/identity`, delete the dep line. Reinstall after each package edit and typecheck:

Run: `pnpm install && pnpm build`
Expected: clean. If a package breaks, it had a direct importer the facade migration missed — route it through `@vibes.diy/identity` (add the missing re-export) rather than re-adding the dep.

- [ ] **Step 3: Run the wire-compat harness one final time**

Run: `cd vibes.diy/api/tests && pnpm vitest --run identity-wire-compat`
Expected: PASS — extracted ⇄ fireproof cross-verification still green, proving byte-compat held across the whole sweep.

- [ ] **Step 4: Enforce repo rules + full check**

Run: `pnpm run rules-bag:constructors && pnpm check`
Expected: green (per `CLAUDE.md`'s ready-to-merge gate).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(identity): sweep now-unused @fireproof device-id/keybag/dash deps repo-wide"
```

- [ ] **Step 6: Update the spec + roadmap status**

In `docs/superpowers/specs/2026-06-19-defireproof-identity-extraction-design.md`, mark Buckets A + B (and the patch removal) as **DONE**; in `docs/superpowers/plans/2026-06-19-defireproof-identity-extraction-foundation.md` roadmap, check off "Plan 2" and "Plan 3". Note the remaining path to **zero `@fireproof/*`**: Bucket E (`SuperThis`/`core-runtime`, #2468) and Bucket F (`core-cli` build tool, #2483).

```bash
git add docs/superpowers/
git commit -m "docs(defireproof): mark identity runtime extraction (Buckets A+B) done"
```

---

## Subsequent plans (roadmap — each its own `writing-plans` pass)

Reaching **zero `@fireproof/*`** after this plan requires, in order:

- **Plan 4 — `SuperThis` decision (Bucket E).** Narrow `RuntimeContext` and migrate the ~30 `ensureSuperThis` call sites onto a thin in-repo runtime-context (spec Q1 resolution); drop `@fireproof/core-runtime`. Tracked: [#2468](https://github.com/VibesDIY/vibes.diy/issues/2468). Also [#2469](https://github.com/VibesDIY/vibes.diy/issues/2469) (browser-graph hardening — durable replacement for the `find-up` exclude).
- **Plan 5 — Build-toolchain swap (Bucket F).** Replace `core-cli tsc`/`build`/`pack`/`publish` across ~33 scripts / ~22 devDeps with `tsc`/`tsup`/in-repo wrapper; drop the `@fireproof/core-cli` devDep repo-wide. Tracked: [#2483](https://github.com/VibesDIY/vibes.diy/issues/2483). Runtime cmd-ts internals swap behind `cli-kit.ts`: [#2482](https://github.com/VibesDIY/vibes.diy/issues/2482).
- **Out of scope (separate track):** Bucket D legacy in-browser IndexedDB (`use-fireproof` in ImgGen / vibe-card) — its own firefly-migration with separate acceptance criteria (spec Q5).

Only after Plans 4 + 5 does `pnpm` resolve **zero** `@fireproof/*` for the identity/PKI surface.

## Self-review notes

- **Spec coverage:** Bucket A → Tasks 2,3,6; Bucket B → Task 4; patch removal → Task 5; Clerk dash-api → Task 5; repo sweep → Task 7. Buckets C (done), D (excluded), E (#2468), F (#2483) mapped to roadmap. Wire-compat hard constraints → the Task 1 cross-verify gate re-run at Tasks 2,3,5,7.
- **No placeholders:** the crypto bodies are an explicit **lift-verbatim** of named installed modules (spec Q2's ratified strategy), not "implement later" — each step names the exact source symbol and target file. Harness, wire-type definitions, facade re-points, patch removal, dep edits, and all verification commands are fully specified. (Deps are not installed in the authoring environment, so exact upstream source lines are referenced by module/symbol rather than inlined; the executing environment has them.)
- **Type consistency:** `createDeviceIdGetToken` signature unchanged; `DashAuthType` / `FPDeviceIDSession` shapes match `node.ts`'s existing usage; verifier union `{valid,payload,header}` matches the foundation harness; `ClerkClaimSchema` is the already-landed `clerk-claim.ts` artifact reused, not redefined.
