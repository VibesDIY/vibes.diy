// Device-id wire-contract harness (owned impl; #2937).
//
// Originally a cross-verification gate between the upstream @fireproof/* device-id
// crypto and the in-repo extraction. With #2937 the upstream `@fireproof/core-device-id`
// dependency is dropped, so this suite now exercises the OWNED impl end-to-end:
// the device-id token header/payload shape, the CSR -> cert issuance contract, the
// minted-token-verifies-under-its-CA round-trip, and the load-bearing Certor
// normalize-then-hash invariant (incomplete claim ⇒ thumbprint mismatch).
//
// The BYTE-LEVEL parity against the dropped upstream path lives in
// `identity/device-id/wire-golden.test.ts`, which pins the owned signer's JWT
// header bytes to a fixture frozen from @fireproof/core-device-id@0.24.19. This
// suite covers behavior; that one covers byte equality.
import { describe, it, expect, beforeAll } from "vitest";
import { ensureSuperThis } from "@vibes.diy/identity";
import type { SuperThis } from "@vibes.diy/identity";
import {
  createTestDeviceCA,
  createTestUser,
  DeviceIdVerifyMsg,
  DeviceIdKey,
  DeviceIdSignMsg,
  DeviceIdCSR,
  DeviceIdCA,
} from "@vibes.diy/identity/testing";

const decodeSeg = (seg: string) => JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
const SESSION_CLAIM_KEYS = ["deviceId", "exp", "iat", "iss", "jti", "nbf", "seq", "sub"];

describe("identity wire-contract (owned device-id crypto)", { timeout: 30000 }, () => {
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
    // Issuance wire-contract: a JWT cert whose payload binds the requested subject
    // to the issuing CA.
    expect(typeof issued.certificateJWT).toBe("string");
    const cert = issued.certificatePayload.certificate;
    expect(cert.subject.commonName).toBe("csr-test");
    expect(cert.issuer.commonName).toBe("Test Device CA");
    expect(issued.certificatePayload.aud).toBe("certificate-authority");
    expect(issued.certificatePayload.sub).toBe("csr-test");
  });

  // Regression for the Certor normalize-then-hash ordering (#2667): the cert
  // thumbprint is computed AFTER CertificatePayloadSchema.parse fills the patched
  // `.catch("")` params defaults, so the issuing claim must be fully populated or
  // the signer's x5t (pre-parse) disagrees with the verifier's (post-parse).
  it("regression: Certor normalize-then-hash — incomplete claim ⇒ thumbprint mismatch, full claim ⇒ x5t match", async () => {
    const mintWith = async (params: Record<string, unknown>) => {
      const key = await DeviceIdKey.create();
      const csr = (await new DeviceIdCSR(sthis, key).createCSR({ commonName: "regr-cn" })).Ok();
      const nowIssue = Math.floor(Date.now() / 1000);
      const issued = (
        await ca.processCSR(csr, {
          azp: "regr",
          exp: nowIssue + 3600,
          iat: nowIssue,
          iss: "test-issuer",
          jti: "regr-cert-jti",
          nbf: nowIssue,
          params,
          role: "device-id",
          sub: "device-id-subject-regr",
          userId: "user-id-regr",
          aud: ["http://test-audience.localhost/"],
        } as never)
      ).Ok();
      const signer = new DeviceIdSignMsg(sthis.txt.base64, key, issued.certificatePayload);
      const now = Math.floor(Date.now() / 1000);
      return signer.sign(
        {
          iss: "regr",
          sub: "device-id",
          deviceId: await key.fingerPrint(),
          seq: 1,
          exp: now + 120,
          nbf: now - 2,
          iat: now,
          jti: "regr-tok-jti",
        },
        "ES256"
      );
    };

    const ownedVerifier = new DeviceIdVerifyMsg(sthis.txt.base64, [(await ca.caCertificate()).Ok()], {
      clockTolerance: 5,
      deviceIdCA: ca as never,
    });

    // Incomplete params ⇒ owned schema fills first/image_url/last/name on the
    // verifier's re-parse ⇒ thumbprint mismatch.
    const incomplete = await mintWith({ email: "regr@example.com", email_verified: true, public_meta: "{}" });
    const vrBad = await ownedVerifier.verifyWithCertificate(incomplete);
    expect(vrBad.valid).toBe(false);
    if (!vrBad.valid) expect((vrBad as { errorCode?: string }).errorCode).toBe("CERT_THUMBPRINT_MISMATCH");

    // Fully-populated params ⇒ parse is a no-op ⇒ x5t / x5t#S256 match ⇒ valid.
    const full = await mintWith({
      nick: "nick-regr",
      email: "regr@example.com",
      email_verified: true,
      first: "first-regr",
      image_url: "http://example.com/image-regr.png",
      last: "last-regr",
      name: "name-regr",
      public_meta: "{}",
    });
    const vrGood = await ownedVerifier.verifyWithCertificate(full);
    expect(vrGood.valid).toBe(true);
    const header = decodeSeg(full.split(".")[0]);
    expect(header).toHaveProperty("x5t");
    expect(header).toHaveProperty("x5t#S256");
  });

  it("a freshly-built CA issues certs verifiable under its own verifier; preserves thumbprint invariant", async () => {
    const fullParams = {
      nick: "nick-ca",
      email: "ca@example.com",
      email_verified: true,
      first: "first-ca",
      image_url: "http://example.com/image-ca.png",
      last: "last-ca",
      name: "name-ca",
      public_meta: "{}",
    };
    const claimFor = (params: Record<string, unknown>) => {
      const n = Math.floor(Date.now() / 1000);
      return {
        azp: "ca-xverify",
        exp: n + 3600,
        iat: n,
        iss: "test-issuer",
        jti: "ca-cert-jti",
        nbf: n,
        params,
        role: "device-id",
        sub: "device-id-subject-ca",
        userId: "user-id-ca",
        aud: ["http://test-audience.localhost/"],
      };
    };

    const caKey = await DeviceIdKey.create();
    const inRepoCA = new DeviceIdCA({
      base64: sthis.txt.base64,
      caKey,
      caSubject: {
        commonName: "In-Repo Test CA",
        organization: "Test",
        locality: "T",
        stateOrProvinceName: "T",
        countryName: "US",
      },
      actions: { generateSerialNumber: async () => sthis.nextId(32).str },
    });
    const caCert = (await inRepoCA.caCertificate()).Ok();

    const mintViaInRepoCA = async (params: Record<string, unknown>) => {
      const devKey = await DeviceIdKey.create();
      const csr = (await new DeviceIdCSR(sthis, devKey).createCSR({ commonName: "ca-dev" })).Ok();
      const issued = (await inRepoCA.processCSR(csr, claimFor(params) as never)).Ok();
      const signer = new DeviceIdSignMsg(sthis.txt.base64, devKey, issued.certificatePayload);
      const now = Math.floor(Date.now() / 1000);
      return signer.sign(
        {
          iss: "ca-xverify",
          sub: "device-id",
          deviceId: await devKey.fingerPrint(),
          seq: 1,
          exp: now + 120,
          nbf: now - 2,
          iat: now,
          jti: "ca-tok-jti",
        },
        "ES256"
      );
    };

    const token = await mintViaInRepoCA(fullParams);
    const inRepoVerifier = new DeviceIdVerifyMsg(sthis.txt.base64, [caCert], {
      clockTolerance: 0,
      deviceIdCA: inRepoCA as never,
    });
    expect((await inRepoVerifier.verifyWithCertificate(token)).valid).toBe(true);

    // Incomplete claim ⇒ CERT_THUMBPRINT_MISMATCH, proving the CA+verifier preserve
    // the normalize-then-hash ordering.
    const badToken = await mintViaInRepoCA({ email: "ca@example.com", email_verified: true, public_meta: "{}" });
    const vrBad = await inRepoVerifier.verifyWithCertificate(badToken);
    expect(vrBad.valid).toBe(false);
    if (!vrBad.valid) expect((vrBad as { errorCode?: string }).errorCode).toBe("CERT_THUMBPRINT_MISMATCH");
  });
});
