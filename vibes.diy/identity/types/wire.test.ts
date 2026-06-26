import { describe, it, expect } from "vitest";
import { generateKeyPair, exportJWK } from "jose";
import { JWKPrivateSchema, JWKPublicSchema } from "./wire.js";
import { JWKPrivateSchema as UpstreamPrivate, JWKPublicSchema as UpstreamPublic } from "@fireproof/core-types-base";

// The owned JWK schemas must accept/reject byte-for-byte the same inputs as the
// upstream core-types-base schemas they replace (the device-id crypto validates
// keys through these). Assert agreement directly against upstream.
describe("JWK schema parity (owned vs @fireproof/core-types-base)", () => {
  it("agrees with upstream on a real ES256 private + public JWK", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const priv = await exportJWK(privateKey);
    const pub = await exportJWK(publicKey);

    expect(JWKPrivateSchema.safeParse(priv).success).toBe(true);
    expect(JWKPrivateSchema.safeParse(priv).success).toBe(UpstreamPrivate.safeParse(priv).success);

    expect(JWKPublicSchema.safeParse(pub).success).toBe(true);
    expect(JWKPublicSchema.safeParse(pub).success).toBe(UpstreamPublic.safeParse(pub).success);

    // Whatever upstream does with a private JWK fed to the public schema, match it.
    expect(JWKPublicSchema.safeParse(priv).success).toBe(UpstreamPublic.safeParse(priv).success);
  });

  it("agrees with upstream on rejecting a malformed JWK (EC missing y)", () => {
    const bad = { kty: "EC", crv: "P-256", x: "only-x" };
    expect(JWKPublicSchema.safeParse(bad).success).toBe(false);
    expect(JWKPublicSchema.safeParse(bad).success).toBe(UpstreamPublic.safeParse(bad).success);
    expect(JWKPrivateSchema.safeParse(bad).success).toBe(UpstreamPrivate.safeParse(bad).success);
  });
});
