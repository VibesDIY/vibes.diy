// Bucket E Phase 4 (T3) cross-verification gate for the lifted `sts` JWK/JWT
// crypto. Every function the identity package re-exports as `sts` is exercised
// against the fireproof original on SHARED key material, so a byte/behaviour
// drift in the lift fails here. The identity vitest config runs in node, so this
// gate runs locally too (not only in CI).
import { describe, it, expect } from "vitest";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { sts as fpSts } from "@fireproof/core-runtime";
import { ensureSuperThis } from "../index.js";
import * as exSts from "./index.js";

const sthis = ensureSuperThis();

async function es256() {
  return generateKeyPair("ES256", { extractable: true });
}

describe("sts lift cross-verification (extracted ⇄ fireproof)", () => {
  it("jwk2env: extracted output is byte-identical to fireproof", async () => {
    const { publicKey } = await es256();
    const exEnv = await exSts.jwk2env(publicKey, sthis);
    const fpEnv = await fpSts.jwk2env(publicKey, sthis);
    expect(exEnv).toBe(fpEnv);
    expect(exEnv.length).toBeGreaterThan(0);
  });

  it("importJWK: extracted matches fireproof (alg + ok)", async () => {
    const { publicKey } = await es256();
    const jwk = { ...(await exportJWK(publicKey)), alg: "ES256" };
    const exR = await exSts.importJWK(jwk);
    const fpR = await fpSts.importJWK(jwk);
    expect(exR.isOk()).toBe(true);
    expect(fpR.isOk()).toBe(true);
    expect(exR.Ok().alg).toBe(fpR.Ok().alg);
  });

  it("env2jwk: extracted decodes fireproof-encoded env material (both directions)", async () => {
    const { publicKey } = await es256();
    const fpEnv = await fpSts.jwk2env(publicKey, sthis);
    const exEnv = await exSts.jwk2env(publicKey, sthis);
    // extracted decodes fireproof-produced env, and vice-versa
    const exFromFp = await exSts.env2jwk(fpEnv, undefined, sthis);
    const fpFromEx = await fpSts.env2jwk(exEnv, undefined, sthis);
    expect(exFromFp.length).toBe(1);
    expect(fpFromEx.length).toBe(1);
  });

  it("verifyToken: a real ES256 JWT verifies under BOTH extracted and fireproof, with the same key material", async () => {
    const { publicKey, privateKey } = await es256();
    const pubJwk = { ...(await exportJWK(publicKey)), alg: "ES256" };
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: "wire-compat" })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey);
    const exR = await exSts.verifyToken(token, [pubJwk], []);
    const fpR = await fpSts.verifyToken(token, [pubJwk], []);
    expect(exR.isOk()).toBe(true);
    expect(fpR.isOk()).toBe(true);
  });

  it("verifyToken: a token signed by a DIFFERENT key is rejected (no false accept)", async () => {
    const signer = await es256();
    const other = await es256();
    const otherPubJwk = { ...(await exportJWK(other.publicKey)), alg: "ES256" };
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ sub: "x" })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(signer.privateKey);
    const exR = await exSts.verifyToken(token, [otherPubJwk], []);
    expect(exR.isOk()).toBe(false);
  });
});
