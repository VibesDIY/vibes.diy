import { describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createAssetSessionSigner, createAssetGrantSigner } from "@vibes.diy/api-svc";

// Same test secret pattern as asset-grant.test.ts — base58btc-encoded JSON
// containing a P-256 ES256 JWK private key.
const TEST_SECRET =
  "z33KxHvFS3jLz72v9DeyGBqo7H34SCC1RA5LvQFCyDiU4r4YBR4jEZxZwA9TqBgm6VB5QzwjrZJoVYkpmHgH7kKJ6Sasat3jTDaBCkqWWfJAVrBL7XapUstnKW3AEaJJKvAYWrKYF9JGqrHNU8WVjsj3MZNyqqk8iAtTPPoKtPTLo2c657daVMkxibmvtz2egnK5wPeYEUtkbydrtBzteN25U7zmGqhS4BUzLjDiYKMLP8Tayi";

async function mkSigner(info?: string) {
  const sthis = ensureSuperThis();
  const r = await createAssetSessionSigner({ sthis, secret: TEST_SECRET, ...(info ? { info } : {}) });
  if (r.isErr()) throw new Error(`createAssetSessionSigner failed: ${r.Err()}`);
  return r.Ok();
}

describe("asset-session signer", () => {
  it("sign/verify roundtrip preserves userId + iat/exp", async () => {
    const signer = await mkSigner();
    const rSigned = await signer.sign({ userId: "u-1" }, 60);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    const { token, expiresAt } = rSigned.Ok();
    expect(typeof token).toBe("string");
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const rVerified = await signer.verify(token);
    if (rVerified.isErr()) throw new Error(`verify failed: ${rVerified.Err()}`);
    const out = rVerified.Ok();
    expect(out.userId).toBe("u-1");
    expect(typeof out.iat).toBe("number");
    expect(typeof out.exp).toBe("number");
    expect(out.exp - out.iat).toBeGreaterThanOrEqual(60);
  });

  it("verify rejects expired tokens", async () => {
    const signer = await mkSigner();
    const rSigned = await signer.sign({ userId: "u" }, -1);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    const rVerified = await signer.verify(rSigned.Ok().token);
    expect(rVerified.isErr()).toBe(true);
  });

  it("verify rejects tampered tokens", async () => {
    const signer = await mkSigner();
    const rSigned = await signer.sign({ userId: "u" }, 60);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    const parts = rSigned.Ok().token.split(".");
    const sig = parts[2];
    parts[2] = sig.slice(0, -2) + (sig.slice(-2) === "AA" ? "BB" : "AA");
    const tampered = parts.join(".");
    const rVerified = await signer.verify(tampered);
    expect(rVerified.isErr()).toBe(true);
  });

  it("HKDF info string discriminates audiences (cross-domain attack defense)", async () => {
    // session signer with default info ≠ grant signer with default info — even
    // though both derive from the same root secret, the HKDF info strings
    // ("vibes.diy.asset-session.v1" vs. "vibes.diy.asset-grant.v1") produce
    // independent keys. A leaked token from one cannot verify against the
    // other.
    const sthis = ensureSuperThis();
    const sessionSigner = (await createAssetSessionSigner({ sthis, secret: TEST_SECRET })).Ok();
    const grantSigner = (await createAssetGrantSigner({ sthis, secret: TEST_SECRET })).Ok();
    if (!sessionSigner || !grantSigner) throw new Error("signer construction failed");
    const rSigned = await sessionSigner.sign({ userId: "u" }, 60);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    const rVerified = await grantSigner.verify(rSigned.Ok().token);
    expect(rVerified.isErr()).toBe(true);
  });

  it("v1 ≠ v2 info — version rotation produces independent keys", async () => {
    const signerV1 = await mkSigner("vibes.diy.asset-session.v1");
    const signerV2 = await mkSigner("vibes.diy.asset-session.v2");
    const rSigned = await signerV1.sign({ userId: "u" }, 60);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    const rVerified = await signerV2.verify(rSigned.Ok().token);
    expect(rVerified.isErr()).toBe(true);
  });
});
