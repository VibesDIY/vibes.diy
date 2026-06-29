// Bucket E byte-compat gate for the lifted `sts` JWK/JWT crypto. T3 proved every
// `sts` function byte-identical to @fireproof/core-runtime via live cross-checks;
// T5 froze the reference key material + jwk2env output into ../golden-fixtures.ts
// and dropped the live dep. Uses a FROZEN ES256 keypair (so jwk2env is pinnable)
// + self-consistent verify/reject invariants. Runs in node.
import { describe, it, expect } from "vitest";
import { importJWK as joseImportJWK, exportJWK, SignJWT, type JWK } from "jose";
import { ensureSuperThis } from "../index.js";
import * as exSts from "./index.js";
import { ES256_PUB_JWK, ES256_PRIV_JWK, JWK2ENV_PUB } from "../golden-fixtures.js";

const sthis = ensureSuperThis();
const PUB: JWK = { ...ES256_PUB_JWK, alg: "ES256" };

async function sign(privJwk: JWK, claims: Record<string, unknown>, expDelta = 300): Promise<string> {
  const key = await joseImportJWK(privJwk, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expDelta)
    .sign(key);
}

describe("sts lift — byte-compat against the frozen fireproof contract", () => {
  it("jwk2env: extracted output is byte-identical to the frozen fireproof value", async () => {
    const pubKey = await joseImportJWK({ ...ES256_PUB_JWK }, "ES256", { extractable: true });
    expect(await exSts.jwk2env(pubKey as CryptoKey, sthis)).toBe(JWK2ENV_PUB);
  });

  it("env2jwk: decodes the frozen env material back to one usable key", async () => {
    const keys = await exSts.env2jwk(JWK2ENV_PUB, undefined, sthis);
    expect(keys.length).toBe(1);
  });

  it("importJWK: ES256 alg + ok", async () => {
    const r = await exSts.importJWK({ ...PUB });
    expect(r.isOk()).toBe(true);
    expect(r.Ok().alg).toBe("ES256");
  });

  it("verifyToken (preset key): a token signed by the frozen key verifies", async () => {
    const token = await sign({ ...ES256_PRIV_JWK, alg: "ES256" } as JWK, { sub: "wire-compat" });
    const r = await exSts.verifyToken(token, [PUB], []);
    expect(r.isOk()).toBe(true);
  });

  it("verifyToken (preset key): a token signed by a DIFFERENT key is rejected (no false accept)", async () => {
    const { privateKey, publicKey } = await (await import("jose")).generateKeyPair("ES256", { extractable: true });
    const token = await new SignJWT({ sub: "x" })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);
    void publicKey;
    // verify against the FROZEN key (different from the signer) → must reject
    const r = await exSts.verifyToken(token, [PUB], []);
    expect(r.isOk()).toBe(false);
  });

  // Charlie review (#2852): exercise the wellKnownUrls / fetchWellKnownJwks branch,
  // not just the preset-key path. Mock global fetch to serve a JWKS containing the
  // frozen public key, and verify a token through the URL path.
  it("verifyToken (well-known JWKS): fetches the JWKS and verifies via the URL branch", async () => {
    const token = await sign({ ...ES256_PRIV_JWK, alg: "ES256" } as JWK, { sub: "jwks-path" });
    const jwks = { keys: [{ ...(await exportJWK(await joseImportJWK({ ...ES256_PUB_JWK }, "ES256"))), alg: "ES256" }] };
    const fetchMock = (async () =>
      new Response(JSON.stringify(jwks), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    // unique URL per run so the module-level JWKS cache doesn't serve a stale entry
    const url = `https://clerk.example.test/${Math.random().toString(36).slice(2)}/.well-known/jwks.json`;
    const r = await exSts.verifyToken(token, [], [url], { fetch: fetchMock });
    expect(r.isOk()).toBe(true);
  });
});
