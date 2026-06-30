import { describe, it, expect } from "vitest";
import { generateKeyPair, exportJWK } from "jose";
import { JWKPrivateSchema, JWKPublicSchema } from "./wire.js";

// The owned JWK schemas are a verbatim lift of the upstream `core-types-base`
// schemas they replace (the device-id crypto validates keys through these).
// #2937 dropped the `@fireproof/core-types-base` dependency, so the accept/reject
// behavior is now pinned against FROZEN expectations rather than a live diff
// against the (removed) upstream schema. These values were the upstream oracle's
// answers at 0.24.19 and are the contract the lift must keep.
describe("JWK schema parity (owned; frozen at core-types-base 0.24.19)", () => {
  it("accepts a real ES256 private + public JWK", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const priv = await exportJWK(privateKey);
    const pub = await exportJWK(publicKey);

    expect(JWKPrivateSchema.safeParse(priv).success).toBe(true);
    expect(JWKPublicSchema.safeParse(pub).success).toBe(true);

    // A private EC JWK fed to the (non-strict) public schema parses: the extra
    // `d` member is ignored — frozen upstream behavior.
    expect(JWKPublicSchema.safeParse(priv).success).toBe(true);
  });

  it("rejects a malformed JWK (EC missing y)", () => {
    const bad = { kty: "EC", crv: "P-256", x: "only-x" };
    expect(JWKPublicSchema.safeParse(bad).success).toBe(false);
    expect(JWKPrivateSchema.safeParse(bad).success).toBe(false);
  });
});
