import { describe, expect, it } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createAssetGrantSigner } from "@vibes.diy/api-svc";

// Test secret pulled from createVibeDiyTestCtx — a base58btc-encoded JSON
// containing a P-256 ES256 JWK private key (the production shape).
const TEST_SECRET =
  "z33KxHvFS3jLz72v9DeyGBqo7H34SCC1RA5LvQFCyDiU4r4YBR4jEZxZwA9TqBgm6VB5QzwjrZJoVYkpmHgH7kKJ6Sasat3jTDaBCkqWWfJAVrBL7XapUstnKW3AEaJJKvAYWrKYF9JGqrHNU8WVjsj3MZNyqqk8iAtTPPoKtPTLo2c657daVMkxibmvtz2egnK5wPeYEUtkbydrtBzteN25U7zmGqhS4BUzLjDiYKMLP8Tayi";

async function mkSigner(info?: string) {
  const sthis = ensureSuperThis();
  const r = await createAssetGrantSigner({ sthis, secret: TEST_SECRET, ...(info ? { info } : {}) });
  if (r.isErr()) throw new Error(`createAssetGrantSigner failed: ${r.Err()}`);
  return r.Ok();
}

describe("asset-grant signer", () => {
  it("sign/verify roundtrip preserves all claims", async () => {
    const signer = await mkSigner();
    const claims = { jti: "upl-1", userId: "u-1", ownerHandle: "alice", appSlug: "notebook", mimeType: "image/png" };
    const rSigned = await signer.sign(claims, 60);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    const { token, expiresAt } = rSigned.Ok();
    expect(typeof token).toBe("string");
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const rVerified = await signer.verify(token);
    if (rVerified.isErr()) throw new Error(`verify failed: ${rVerified.Err()}`);
    const out = rVerified.Ok();
    expect(out.jti).toBe("upl-1");
    expect(out.userId).toBe("u-1");
    expect(out.ownerHandle).toBe("alice");
    expect(out.appSlug).toBe("notebook");
    expect(out.mimeType).toBe("image/png");
    expect(typeof out.iat).toBe("number");
    expect(typeof out.exp).toBe("number");
    expect(out.exp - out.iat).toBeGreaterThanOrEqual(60);
  });

  it("verify rejects expired tokens", async () => {
    const signer = await mkSigner();
    const rSigned = await signer.sign({ jti: "upl-x", userId: "u", ownerHandle: "a", appSlug: "b" }, -1);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    const rVerified = await signer.verify(rSigned.Ok().token);
    expect(rVerified.isErr()).toBe(true);
  });

  it("verify rejects tampered tokens", async () => {
    const signer = await mkSigner();
    const rSigned = await signer.sign({ jti: "upl-tamper", userId: "u", ownerHandle: "a", appSlug: "b" }, 60);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    // Flip one byte of the signature segment.
    const parts = rSigned.Ok().token.split(".");
    const sig = parts[2];
    parts[2] = sig.slice(0, -2) + (sig.slice(-2) === "AA" ? "BB" : "AA");
    const tampered = parts.join(".");
    const rVerified = await signer.verify(tampered);
    expect(rVerified.isErr()).toBe(true);
  });

  it("HKDF info string discriminates audiences (cross-domain attack defense)", async () => {
    const signerV1 = await mkSigner("vibes.diy.asset-grant.v1");
    const signerV2 = await mkSigner("vibes.diy.asset-grant.v2");
    const rSigned = await signerV1.sign({ jti: "upl-cross", userId: "u", ownerHandle: "a", appSlug: "b" }, 60);
    if (rSigned.isErr()) throw new Error(`sign failed: ${rSigned.Err()}`);
    // Same root secret, different info → different derived keys → v2 must reject.
    const rVerified = await signerV2.verify(rSigned.Ok().token);
    expect(rVerified.isErr()).toBe(true);
  });
});
