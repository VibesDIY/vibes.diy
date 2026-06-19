# De-fireproof Identity Extraction — Plan 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the non-negotiable safety gate for removing `@fireproof/*` — a golden **wire-compatibility harness** that pins the current device-id token + CSR→cert + verify contract — plus the empty `@vibes.diy/identity` package scaffold and a thin in-repo runtime-context seam, so later extraction phases can be proven equivalent before any broad file churn.

**Architecture:** Per the [design spec](../specs/2026-06-19-defireproof-identity-extraction-design.md) and the `@CharlieHelps` review resolutions: harness first, thin runtime-context boundary second, broad churn never before those exist. This plan touches **no** existing source — it adds a test suite (against the current fireproof impl, capturing the baseline) and an empty package shell. The extraction itself is Plans 2+.

**Tech Stack:** TypeScript, Vitest 4, pnpm workspaces, `@fireproof/core-device-id` (`DeviceIdKey`/`DeviceIdSignMsg`/`DeviceIdVerifyMsg`/`DeviceIdCSR`/`DeviceIdCA`, all `jose`-based ES256), `@adviser/cement`.

---

## Background facts (verified against installed `0.24.19`)

- `createTestDeviceCA(sthis)` → `DeviceIdCA` with `.processCSR(csrJWS, clerkClaim)`, `.caCertificate(): Promise<Result<CACertResult>>`, `.getCAKey()`.
- `createTestUser({sthis, deviceCA, session, seqUserId})` → `{ devkey: DeviceIdKey, deviceIdSigner: DeviceIdSignMsg, getDashBoardToken(): Promise<DashAuthType> }`.
- A minted device-id token: header `{alg:"ES256", typ:"JWT", kid, x5c, x5t, x5t#S256}`; payload keys `{iss, sub, deviceId, seq, exp, nbf, iat, jti}` (= `FPDeviceIDSession`).
- `new DeviceIdVerifyMsg(sthis.txt.base64, [caCertResult], { clockTolerance, deviceIdCA }).verifyWithCertificate(jwt)` → a `valid`-discriminated union: success `{ valid: true, payload, header, certificate, verificationTimestamp }` or error `{ valid: false, error, errorCode, ... }` (NOT a cement `Result`; narrow on `vr.valid` before reading `payload`/`header`, which are typed `unknown`).
- `DeviceIdKey.create()` / `.createFromJWK(jwk)` / `.exportPrivateJWK()` / `.publicKey()` / `.fingerPrint()`.
- The harness lives in `vibes.diy/api/tests` (already deps `@fireproof/core-device-id`, `core-runtime`, `core-types-base`, `core-types-device-id`, `@adviser/cement`; runner `vitest --run`).

## File Structure

- Create: `vibes.diy/api/tests/identity-wire-compat.test.ts` — the golden harness. One responsibility: assert the current device-id/CSR/verify wire contract. Designed so Plan 2 adds cross-verification (extracted-mints-verify-under-fireproof and vice-versa) by swapping one `mint`/`verify` factory.
- Create: `vibes.diy/identity/package.json`, `vibes.diy/identity/tsconfig.json`, `vibes.diy/identity/index.ts`, `vibes.diy/identity/runtime-context.ts`, `vibes.diy/identity/vitest.config.ts`, `vibes.diy/identity/runtime-context.test.ts` — empty `@vibes.diy/identity` shell + the thin runtime-context seam.

---

## Task 1: Golden wire-compatibility harness (the gate)

**Files:**

- Create: `vibes.diy/api/tests/identity-wire-compat.test.ts`

- [x] **Step 1: Write the harness test file**

```ts
// Golden wire-compat harness. Pins the CURRENT (@fireproof/* 0.24.19) device-id
// token / CSR->cert / verify contract so the extracted @vibes.diy/identity impl
// can be proven equivalent. Plan 2 extends this with cross-verification by
// swapping the `mint`/`verify` factories below for the extracted ones.
import { describe, it, expect, beforeAll } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import {
  createTestDeviceCA,
  createTestUser,
  DeviceIdVerifyMsg,
  DeviceIdKey,
  DeviceIdSignMsg,
  DeviceIdCSR,
} from "@fireproof/core-device-id";
import type { SuperThis } from "@fireproof/core-types-base";

const decodeSeg = (seg: string) => JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
const SESSION_CLAIM_KEYS = ["deviceId", "exp", "iat", "iss", "jti", "nbf", "seq", "sub"];

describe("identity wire-compat (baseline: @fireproof/* 0.24.19)", { timeout: 30000 }, () => {
  const sthis: SuperThis = ensureSuperThis();
  let ca: Awaited<ReturnType<typeof createTestDeviceCA>>;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let verifier: DeviceIdVerifyMsg;

  beforeAll(async () => {
    ca = await createTestDeviceCA(sthis);
    user = await createTestUser({ sthis, deviceCA: ca, session: "wire-compat", seqUserId: 1 });
    const caCert = (await ca.caCertificate()).Ok();
    verifier = new DeviceIdVerifyMsg(sthis.txt.base64, [caCert], { clockTolerance: 0, deviceIdCA: ca });
  });

  it("device-id token header is ES256/JWT with cert-chain headers", async () => {
    const tok = await user.getDashBoardToken();
    expect(tok.type).toBe("device-id");
    const header = decodeSeg(tok.token.split(".")[0]);
    expect(header.alg).toBe("ES256");
    expect(header.typ).toBe("JWT");
    for (const k of ["kid", "x5c", "x5t", "x5t#S256"]) expect(header).toHaveProperty(k);
  });

  it("device-id token payload carries exactly the FPDeviceIDSession claims", async () => {
    const tok = await user.getDashBoardToken();
    const payload = decodeSeg(tok.token.split(".")[1]);
    expect(Object.keys(payload).sort()).toEqual(SESSION_CLAIM_KEYS);
    expect(payload.sub).toBe("device-id");
  });

  it("a minted token verifies under the issuing CA", async () => {
    const tok = await user.getDashBoardToken();
    const vr = await verifier.verifyWithCertificate(tok.token);
    expect(vr.valid).toBe(true);
    if (!vr.valid) throw new Error(String(vr.error));
    expect((vr.payload as { sub?: string }).sub).toBe("device-id");
    expect((vr.header as { alg?: string }).alg).toBe("ES256");
  });

  it("JWT header+payload segments are byte-stable for fixed claims (only the signature varies)", async () => {
    const key = await DeviceIdKey.create();
    const csr = (await new DeviceIdCSR(sthis, key).createCSR({ commonName: "fixed-cn" })).Ok();
    const issued = (await ca.processCSR(csr, { sub: "user_fixed", email: "fixed@example.com" } as never)).Ok();
    const signer = new DeviceIdSignMsg(sthis.txt.base64, key, issued.certificatePayload);
    const fixed = {
      iss: "wire-compat",
      sub: "device-id",
      deviceId: await key.fingerPrint(),
      seq: 1,
      exp: 4102444800,
      nbf: 0,
      iat: 0,
      jti: "fixed-jti",
    };
    const [a, b] = await Promise.all([signer.sign(fixed, "ES256"), signer.sign(fixed, "ES256")]);
    const [ha, pa, sa] = a.split(".");
    const [hb, pb, sb] = b.split(".");
    expect(ha).toBe(hb); // header byte-identical
    expect(pa).toBe(pb); // payload byte-identical
    expect(sa).not.toBe(sb); // ES256 signatures are randomized
  });

  it("CSR -> cert issuance produces a CA-signed certificate with the requested subject", async () => {
    const key = await DeviceIdKey.create();
    const csr = (await new DeviceIdCSR(sthis, key).createCSR({ commonName: "csr-test" })).Ok();
    const rIssued = await ca.processCSR(csr, { sub: "user_csr", email: "csr@example.com" } as never);
    expect(rIssued.isOk()).toBe(true);
    const issued = rIssued.Ok();
    // Issuance wire-contract: a JWT cert whose payload binds the requested
    // subject to the issuing CA. The extracted CA must reproduce this shape.
    expect(typeof issued.certificateJWT).toBe("string");
    const cert = issued.certificatePayload.certificate;
    expect(cert.subject.commonName).toBe("csr-test");
    expect(cert.issuer.commonName).toBe("Test Device CA");
    expect(issued.certificatePayload.aud).toBe("certificate-authority");
    expect(issued.certificatePayload.sub).toBe("csr-test");
  });
});
```

> Note: the harness asserts the **issuance wire-contract** (CA-signed cert with the
> requested subject) rather than a full token-verify roundtrip under a hand-issued
> cert — the latter depends on fireproof-internal `ClerkClaim` semantics not central
> to the gate. Cross-verification of extracted-vs-fireproof tokens is added in Plan 3.

- [x] **Step 2: Run the harness, confirm it passes against the current impl**

Run: `cd vibes.diy/api/tests && pnpm exec vitest --run identity-wire-compat`
Expected: PASS (5 tests). This is the baseline the extracted impl must reproduce.

- [x] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/identity-wire-compat.test.ts
git commit -m "test: golden wire-compat harness pinning the device-id/cert contract"
```

## Task 2: `@vibes.diy/identity` package scaffold + thin runtime-context seam

**Files:**

- Create: `vibes.diy/identity/package.json`
- Create: `vibes.diy/identity/tsconfig.json`
- Create: `vibes.diy/identity/index.ts`
- Create: `vibes.diy/identity/runtime-context.ts`
- Create: `vibes.diy/identity/runtime-context.test.ts`
- Create: `vibes.diy/identity/vitest.config.ts`

- [x] **Step 1: Write `runtime-context.test.ts` (failing — module absent)**

```ts
import { describe, it, expect } from "vitest";
import { ensureRuntimeContext } from "./runtime-context.js";

describe("ensureRuntimeContext", () => {
  it("returns a stable singleton with env + nextId", () => {
    const a = ensureRuntimeContext();
    const b = ensureRuntimeContext();
    expect(a).toBe(b);
    expect(typeof a.nextId().str).toBe("string");
    expect(a.nextId().str).not.toBe(a.nextId().str);
  });
});
```

- [x] **Step 2: Run it, confirm it fails**

Run: `cd vibes.diy/identity && pnpm exec vitest --run runtime-context`
Expected: FAIL — cannot resolve `./runtime-context.js`.

- [x] **Step 3: Implement the thin runtime-context seam**

`runtime-context.ts` — the in-repo boundary that later replaces `ensureSuperThis` at identity call sites. v1 delegates to the existing `SuperThis` so behavior is identical; Plan 4 narrows the surface and (optionally) drops the fireproof backing.

```ts
import { ensureSuperThis } from "@fireproof/core-runtime";
import type { SuperThis } from "@fireproof/core-types-base";

// The minimal runtime surface identity code needs. Intentionally a strict
// subset of SuperThis so the dependency can later be inverted (own impl or
// pushed into @adviser/cement) without touching call sites.
export type RuntimeContext = Pick<SuperThis, "env" | "txt" | "nextId">;

let singleton: RuntimeContext | undefined;
export function ensureRuntimeContext(): RuntimeContext {
  return (singleton ??= ensureSuperThis());
}
```

- [x] **Step 4: Add `index.ts`, `package.json`, `tsconfig.json`, `vitest.config.ts`**

`index.ts`:

```ts
export { ensureRuntimeContext, type RuntimeContext } from "./runtime-context.js";
```

`package.json` (mirrors `vibes.diy/api/impl/package.json` conventions; `version` stays `0.0.0`, build via `core-cli` for now — Bucket F swaps this later):

```json
{
  "name": "@vibes.diy/identity",
  "version": "0.0.0",
  "type": "module",
  "main": "./index.js",
  "scripts": { "build": "core-cli tsc", "test": "vitest --run" },
  "dependencies": {
    "@adviser/cement": "^0.5.34",
    "@fireproof/core-runtime": "0.24.19",
    "@fireproof/core-types-base": "0.24.19"
  },
  "devDependencies": { "@fireproof/core-cli": "0.24.19", "vitest": "~4.1.9" }
}
```

`tsconfig.json` — copy `vibes.diy/api/impl/tsconfig.json` verbatim (same compiler settings/refs baseline).

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["**/*.test.ts"] } });
```

- [x] **Step 5: Install + run the package test**

Run: `pnpm install && cd vibes.diy/identity && pnpm exec vitest --run`
Expected: PASS (1 test). `pnpm install` wires the new workspace.

- [x] **Step 6: Typecheck the new package compiles in the monorepo**

Run: `cd vibes.diy/identity && pnpm exec tsc --noEmit`
Expected: no errors.

- [x] **Step 7: Commit**

```bash
git add vibes.diy/identity pnpm-lock.yaml
git commit -m "feat(identity): scaffold @vibes.diy/identity + thin runtime-context seam"
```

---

## Subsequent plans (roadmap — each its own plan, gated by Task 1's harness)

Per the spec's risk-ordered phasing. These are **not** detailed here; each gets its own `writing-plans` pass when its predecessor lands and the harness stays green.

- **Plan 2 — Type ownership (spec phase 1).** Re-home Bucket B auth wire-types into `@vibes.diy/identity`; inline the `ClerkClaimSchema` `.catch()` patch; delete `patches/@fireproof__core-types-base@0.24.19.patch`. Extend the harness with type-level parity assertions. (Mechanical, erasable, low blast radius.)
- **Plan 3 — Identity runtime extraction (spec phase 2 + Clerk dash-api).** Lift-verbatim device-id signer / keybag / CA-verify + the `core-protocols-dashboard` runtime client behind one `createDeviceIdGetToken()` API; collapse the 3 duplicated client signers. **Gate:** extend Task 1's harness with cross-verification (extracted-mints ⇄ fireproof-verifies).
- **Plan 4 — Own the login localhost server (spec phase 3 → closes #1616).** Replace the `core-cli` device-id-register dependency with our `login-server` + a styled `/cert` success page.
- **Plan 5 — `SuperThis` decision (spec phase 4).** Narrow `RuntimeContext` and migrate the ~30 `ensureSuperThis` call sites onto it; optionally upstream into `@adviser/cement`.
- **Plan 6 — Legacy IndexedDB migration (Bucket D, separate track).**
- **Plan 7 — Build-toolchain swap (Bucket F, separate track).** Replace `core-cli tsc`/`build`/`pack`/`publish`; drop the `@fireproof/core-cli` devDep repo-wide → true zero `@fireproof/*`.

## Self-review notes

- Spec coverage: this plan implements only the agreed **pre-churn gates** (harness + runtime-context boundary + package shell); every other spec bucket is mapped to a named subsequent plan above.
- No placeholders: all code shown is runnable; the subsequent-plans section is an intentional roadmap, not faux tasks.
- Type consistency: `ensureRuntimeContext`/`RuntimeContext` names match across `runtime-context.ts`, `index.ts`, and the test; harness uses the verified `verifyWithCertificate` `{valid,payload,header}` shape.
