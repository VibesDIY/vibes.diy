// Golden auth-verify harness (de-fireproof Task 5 — hardening BEFORE the lift).
//
// These paths had ZERO direct coverage and are exactly what the Task 5 cutover
// replaces: the server token verifiers behind `tokenApi` (Clerk RS256 verify +
// device-id cert verify). The System-Under-Test is imported through the
// `@vibes.diy/identity/server` FACADE, so this same suite gates the behavior both
// now (facade → upstream `@fireproof/core-protocols-dashboard`) and after the
// cutover (facade → in-repo lift). The lift must keep every LEGITIMATE-input
// assertion green.
//
// SECURITY (#2671): we deliberately do NOT assert that a forged, CA-never-signed
// certificate is accepted. The one security case below asserts the DESIRED
// outcome (forged cert → rejected) and is marked `it.fails` because the current
// verifier wrongly accepts it (issuer-NAME trust, not CA-signature). When #2671
// is hardened the verifier will reject → `it.fails` flips to failing-because-it-
// passed → we remove the marker. So this tracks the fix without ever locking in
// the bad behavior.
import { describe, it, expect, beforeAll } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser, DeviceIdKey, DeviceIdSignMsg, DeviceIdCSR } from "@fireproof/core-device-id";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import type { SuperThis } from "@fireproof/core-types-base";
// SUT via the facade — currently upstream, in-repo after the cutover.
import { tokenApi } from "@vibes.diy/identity/server";
// Browser `.` facade — what VibesDiyApi.getTokenClaims() actually imports.
import { ClerkApiToken } from "@vibes.diy/identity";

const fullParams = {
  nick: "nick",
  email: "user@example.com",
  email_verified: true,
  first: "First",
  image_url: "http://x/y.png",
  last: "Last",
  name: "Full Name",
  public_meta: "{}",
};
const clerkClaim = (over: Record<string, unknown> = {}) => ({
  azp: "test-app",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  iss: "test-issuer",
  jti: "jti-golden",
  nbf: Math.floor(Date.now() / 1000),
  params: fullParams,
  role: "device-id",
  sub: "device-id-subject-golden",
  userId: "user-id-golden",
  aud: ["http://test-audience.localhost/"],
  ...over,
});

describe("auth token verify — golden (SUT via @vibes.diy/identity/server)", { timeout: 30000 }, () => {
  const sthis: SuperThis = ensureSuperThis();
  let ca: Awaited<ReturnType<typeof createTestDeviceCA>>;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let api: Awaited<ReturnType<typeof tokenApi>>;

  beforeAll(async () => {
    ca = await createTestDeviceCA(sthis);
    user = await createTestUser({ sthis, deviceCA: ca, session: "golden", seqUserId: 1 });
    api = await tokenApi(sthis, { deviceIdCA: ca, clockTolerance: 5, maxAge: 3600 } as never);
  });

  // --- device-id token verify (legitimate) -----------------------------------
  it("device-id: a CA-issued token verifies and yields the embedded clerk claims", async () => {
    const tok = await user.getDashBoardToken();
    const r = await api["device-id"].verify(tok.token);
    expect(r.isOk()).toBe(true);
    const v = r.Ok();
    expect(v.type).toBe("device-id");
    expect((v.claims as { userId?: string }).userId).toBeTruthy();
  });

  it("device-id: a garbage token is rejected", async () => {
    const r = await api["device-id"].verify("not.a.jwt");
    expect(r.isErr()).toBe(true);
  });

  // --- SECURITY #2671: forged self-issued cert (CA never signed it) -----------
  // The verifier trusts the embedded x5c cert by issuer-NAME match + self-
  // consistent thumbprint and verifies the token with the cert's OWN key — it
  // never checks the cert was CA-signed. So an attacker can mint a cert naming
  // the CA as issuer, embed their own public key, and self-sign a passing token.
  // DESIRED behavior is rejection; today it is wrongly accepted → `it.fails`.
  it.fails("SECURITY #2671: a forged (CA-never-signed) cert token MUST be rejected", async () => {
    // Real cert payload only to copy the exact CA-issued shape.
    const realKey = await DeviceIdKey.create();
    const realCsr = (await new DeviceIdCSR(sthis, realKey).createCSR({ commonName: "real" })).Ok();
    const realCert = (await ca.processCSR(realCsr, clerkClaim() as never)).Ok().certificatePayload;

    // Attacker substitutes their OWN public key into a cert that names the CA as
    // issuer — the CA never signs this. Token is self-signed with the attacker key.
    const attackerKey = await DeviceIdKey.create();
    const forgedCert = {
      ...realCert,
      certificate: { ...realCert.certificate, subjectPublicKeyInfo: await attackerKey.publicKey() },
    };
    const now = Math.floor(Date.now() / 1000);
    const forgedToken = await new DeviceIdSignMsg(sthis.txt.base64, attackerKey, forgedCert as never).sign(
      {
        iss: "forged",
        sub: "device-id",
        deviceId: await attackerKey.fingerPrint(),
        seq: 1,
        exp: now + 120,
        nbf: now - 2,
        iat: now,
        jti: "forged-jti",
      },
      "ES256"
    );

    const r = await api["device-id"].verify(forgedToken);
    // DESIRED: the forgery is rejected. (Currently fails → tracked by it.fails / #2671.)
    expect(r.isErr()).toBe(true);
  });

  // --- Clerk RS256 token verify (legitimate) ---------------------------------
  it("clerk: an RS256 token signed by the configured key verifies", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const pubJwk = await exportJWK(publicKey);
    sthis.env.set("CLERK_PUB_JWT_KEY", JSON.stringify({ ...pubJwk, alg: "RS256", use: "sig" }));

    const token = await new SignJWT(clerkClaim() as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "golden-clerk" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const r = await api.clerk.verify(token);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.Ok().type).toBe("clerk");
  });

  // --- Clerk decode (client path: VibesDiyApi.getTokenClaims) ----------------
  // REGRESSION (#2706 / Codex P1): the browser `getTokenClaims()` path calls
  // `new ClerkApiToken(sthis).decode(token)`, which parses with `ClerkClaimSchema`.
  // Real Clerk JWTs OMIT `first`/`image_url`/`last`/`name`; the dropped
  // `core-types-base` patch used to backfill them via `.catch()`. The owned
  // lenient schema must keep doing so, or signed-in users fail before `openChat`.
  it("clerk: decode() accepts a real-shaped claim that omits first/image_url/last/name", async () => {
    const paramsNoProfile = {
      nick: "nick",
      email: "user@example.com",
      email_verified: true,
      public_meta: "{}",
      // first / image_url / last / name deliberately ABSENT (real Clerk JWT shape)
    };
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const token = await new SignJWT(clerkClaim({ params: paramsNoProfile }) as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "golden-clerk" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const r = await api.clerk.decode(token);
    expect(r.isOk()).toBe(true);
    const claims = r.Ok().claims as { params: { first: string; image_url: string; last: string; name: string | null } };
    expect(claims.params.first).toBe("");
    expect(claims.params.image_url).toBe("");
    expect(claims.params.last).toBe("");
    expect(claims.params.name).toBe(null);

    // Guard the exact seam Codex P1'd: the browser `.` facade must export the
    // OWNED lenient ClerkApiToken, not the upstream strict one. If `index.ts` is
    // re-pointed back at `@fireproof/core-protocols-dashboard`, this decode throws.
    const browserDecode = await new ClerkApiToken(sthis).decode(token);
    expect(browserDecode.isOk()).toBe(true);
  });

  it("clerk: a token signed by a DIFFERENT key is rejected", async () => {
    const { publicKey } = await generateKeyPair("RS256", { extractable: true });
    const pubJwk = await exportJWK(publicKey);
    sthis.env.set("CLERK_PUB_JWT_KEY", JSON.stringify({ ...pubJwk, alg: "RS256", use: "sig" }));

    const { privateKey: otherPriv } = await generateKeyPair("RS256", { extractable: true });
    const token = await new SignJWT(clerkClaim() as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "golden-clerk" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(otherPriv);

    const r = await api.clerk.verify(token);
    expect(r.isErr()).toBe(true);
  });
});
