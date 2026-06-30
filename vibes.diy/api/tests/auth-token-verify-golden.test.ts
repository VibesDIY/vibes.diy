// Golden auth-verify harness for the server token verifiers behind `tokenApi`
// (Clerk RS256 verify + device-id cert verify). The System-Under-Test is imported
// through the `@vibes.diy/identity/server` FACADE; with #2937 every device-id
// primitive — the test CA/user harness, the signer, the verifier — is the in-repo
// owned impl (no `@fireproof/core-device-id` left). The 3-arg `DeviceIdSignMsg`
// (no `certificateJWT`) constructs the legacy / forged (CA-unsigned) shapes; the
// 4-arg form embeds the CA-signed cert chain (`x5c#jwt`).
//
// SECURITY (#2671): FIXED. The verifier now checks the CA's signature over the
// embedded cert (carried as a `CERT+JWT` in the `x5c#jwt` header), not just that
// the cert's `iss` string names the CA. The cases below pin: a forged
// (CA-never-signed) cert is rejected, a spliced real-cert-over-different-key is
// rejected, a genuine CA-signed token verifies, and the enforcement is gated by
// DEVICE_ID_REQUIRE_CA_SIGNATURE (default-off for older-CLI compat during rollout).
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { MockLogger } from "@adviser/cement";
import { createTestDeviceCA, createTestUser, DeviceIdKey, DeviceIdSignMsg, DeviceIdCSR } from "@vibes.diy/identity/testing";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import type { SuperThis } from "@vibes.diy/identity";
import { tokenApi, DeviceIdApiToken } from "@vibes.diy/identity/server";
// Browser `.` facade — what VibesDiyApi.getTokenClaims() actually imports.
import { ClerkApiToken, ensureSuperThis } from "@vibes.diy/identity";

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
  // The legacy verifier trusted the embedded x5c cert by issuer-NAME match + self-
  // consistent thumbprint and verified the token with the cert's OWN key — it never
  // checked the cert was CA-signed. So an attacker could mint a cert naming the CA
  // as issuer, embed their own public key, and self-sign a passing token.
  //
  // The fix: tokens now carry the CA-signed cert as a `CERT+JWT` in the `x5c#jwt`
  // header, and the verifier checks that signature against the trusted CA's key.
  // Enforcement (reject tokens lacking a verifiable chain signature) is gated by
  // DEVICE_ID_REQUIRE_CA_SIGNATURE so older published CLIs keep working until the
  // CA-signing CLI is rolled out; these tests pin the behavior with it enabled.
  const ENFORCE_ENV = "DEVICE_ID_REQUIRE_CA_SIGNATURE";
  afterEach(() => sthis.env.set(ENFORCE_ENV, "false"));

  // Mint a LEGITIMATE token via the owned signer, embedding the CA-signed cert
  // chain (`x5c#jwt`) the same way createDeviceIdGetToken does from the keybag.
  async function mintCASignedToken() {
    const key = await DeviceIdKey.create();
    const csr = (await new DeviceIdCSR(sthis, key).createCSR({ commonName: "ca-signed" })).Ok();
    const issued = (await ca.processCSR(csr, clerkClaim() as never)).Ok();
    const now = Math.floor(Date.now() / 1000);
    const token = await new DeviceIdSignMsg(sthis.txt.base64, key, issued.certificatePayload as never, issued.certificateJWT).sign(
      {
        iss: "ca-signed",
        sub: "device-id",
        deviceId: await key.fingerPrint(),
        seq: 1,
        exp: now + 120,
        nbf: now - 2,
        iat: now,
        jti: "ca-signed-jti",
      },
      "ES256"
    );
    return token;
  }

  it("SECURITY #2671: a forged (CA-never-signed) cert token MUST be rejected when enforcing", async () => {
    sthis.env.set(ENFORCE_ENV, "true");
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
    expect(r.isErr()).toBe(true);
  });

  it("SECURITY #2671: stapling a real CA-signed cert over a forged device cert is rejected", async () => {
    sthis.env.set(ENFORCE_ENV, "true");
    // A real, CA-signed cert (+ its CERT+JWT) for some legitimate device.
    const realKey = await DeviceIdKey.create();
    const realCsr = (await new DeviceIdCSR(sthis, realKey).createCSR({ commonName: "real-spliced" })).Ok();
    const issued = (await ca.processCSR(realCsr, clerkClaim() as never)).Ok();

    // Attacker forges an x5c[0] cert carrying THEIR key (so the token signature
    // verifies and the thumbprint is self-consistent), then staples the victim's
    // genuine CA-signed `x5c#jwt`. The chain signature verifies against the CA, but
    // its payload binds the victim's key — the cert<->x5c#jwt mismatch must reject.
    const attackerKey = await DeviceIdKey.create();
    const forgedCert = {
      ...issued.certificatePayload,
      certificate: { ...issued.certificatePayload.certificate, subjectPublicKeyInfo: await attackerKey.publicKey() },
    };
    const now = Math.floor(Date.now() / 1000);
    const splicedToken = await new DeviceIdSignMsg(
      sthis.txt.base64,
      attackerKey as never,
      forgedCert as never,
      issued.certificateJWT
    ).sign(
      {
        iss: "spliced",
        sub: "device-id",
        deviceId: await attackerKey.fingerPrint(),
        seq: 1,
        exp: now + 120,
        nbf: now - 2,
        iat: now,
        jti: "spliced-jti",
      },
      "ES256"
    );

    const r = await api["device-id"].verify(splicedToken);
    expect(r.isErr()).toBe(true);
  });

  it("SECURITY #2671: a present-but-INVALID chain signature is rejected even when NOT enforcing", async () => {
    // CharlieHelps follow-up: pin that a present x5c#jwt that does NOT verify
    // against the CA is rejected regardless of the flag — only the *missing*-chain
    // case is gated. The attacker even holds a real CA-signed cert here, but
    // staples a chain signed by a NON-CA key, so jwtVerify against the CA fails.
    sthis.env.set(ENFORCE_ENV, "false");
    const attackerKey = await DeviceIdKey.create();
    const csr = (await new DeviceIdCSR(sthis, attackerKey).createCSR({ commonName: "invalid-chain" })).Ok();
    const issued = (await ca.processCSR(csr, clerkClaim() as never)).Ok();
    // Re-sign the cert payload with a key the CA never authorized.
    const { privateKey: nonCaKey } = await generateKeyPair("ES256", { extractable: true });
    const forgedChain = await new SignJWT(issued.certificatePayload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "ES256", typ: "CERT+JWT" })
      .sign(nonCaKey);
    const now = Math.floor(Date.now() / 1000);
    const token = await new DeviceIdSignMsg(
      sthis.txt.base64,
      attackerKey as never,
      issued.certificatePayload as never,
      forgedChain
    ).sign(
      {
        iss: "invalid-chain",
        sub: "device-id",
        deviceId: await attackerKey.fingerPrint(),
        seq: 1,
        exp: now + 120,
        nbf: now - 2,
        iat: now,
        jti: "invalid-chain-jti",
      },
      "ES256"
    );
    const r = await api["device-id"].verify(token);
    expect(r.isErr()).toBe(true);
  });

  it("SECURITY #2671: a genuine CA-signed token still verifies when enforcing", async () => {
    sthis.env.set(ENFORCE_ENV, "true");
    const token = await mintCASignedToken();
    const r = await api["device-id"].verify(token);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.Ok().type).toBe("device-id");
  });

  it("SECURITY #2671: a legacy CA-unsigned token is accepted when NOT enforcing, rejected when enforcing", async () => {
    // The fireproof helper mints the legacy shape (no x5c#jwt). Default-off keeps
    // older CLIs working; flipping the flag closes the bypass.
    const legacy = await user.getDashBoardToken();
    sthis.env.set(ENFORCE_ENV, "false");
    expect((await api["device-id"].verify(legacy.token)).isOk()).toBe(true);
    sthis.env.set(ENFORCE_ENV, "true");
    expect((await api["device-id"].verify(legacy.token)).isErr()).toBe(true);
  });

  // --- #2824 adoption visibility ---------------------------------------------
  // While DEVICE_ID_REQUIRE_CA_SIGNATURE is still gated off, verify() emits a
  // per-token log of whether the CA-signed cert chain (`x5c#jwt`) is present, so
  // the rollout can flip enforcement when `chainSignature:absent` ≈ 0 instead of
  // guessing a calendar date. Pin that both token shapes are reported correctly.
  it("#2824: verify() logs chainSignature present for a 3.0 token and absent for a legacy one", async () => {
    const { logger, logCollector } = MockLogger();
    // Construct DeviceIdApiToken directly (not via the Lazy-memoized `tokenApi`,
    // which would hand back the shared-sthis instance) so verify() logs through
    // this MockLogger and the collector captures the structured rows.
    const logSthis = ensureSuperThis({ logger });
    const logToken = new DeviceIdApiToken(logSthis, { deviceIdCA: ca, clockTolerance: 5, maxAge: 3600 } as never);

    await logToken.verify(await mintCASignedToken()); // 3.0 shape → present
    await logToken.verify((await user.getDashBoardToken()).token); // legacy shape → absent

    await logger.Flush();
    const sigs = (logCollector.Logs() as Record<string, unknown>[])
      .filter((l) => l.msg === "device-id-chain-signature")
      .map((l) => l.chainSignature);
    expect(sigs).toEqual(["present", "absent"]);
  });

  // The log fires ONLY on a successful device-id verify, so non-device-id probe
  // traffic (a Clerk bearer that `/_auth/session` tries against this verifier
  // first) never pollutes the `absent` rollout signal. Pin that a failed verify
  // emits no adoption log at all. (Codex/Charlie review on #2956.)
  it("#2824: verify() emits NO adoption log for a token that fails device-id verification", async () => {
    const { logger, logCollector } = MockLogger();
    const logSthis = ensureSuperThis({ logger });
    const logToken = new DeviceIdApiToken(logSthis, { deviceIdCA: ca, clockTolerance: 5, maxAge: 3600 } as never);

    // A Clerk-shaped RS256 bearer (no x5c device cert) — the kind of token the
    // bearer-bridge probes against device-id before falling through to clerk.
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const clerkBearer = await new SignJWT(clerkClaim() as Record<string, unknown>)
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: "golden-clerk" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    expect((await logToken.verify(clerkBearer)).isErr()).toBe(true); // fails device-id verify
    expect((await logToken.verify("not.a.jwt")).isErr()).toBe(true); // garbage probe

    await logger.Flush();
    const sigs = (logCollector.Logs() as Record<string, unknown>[]).filter((l) => l.msg === "device-id-chain-signature");
    expect(sigs).toEqual([]);
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
