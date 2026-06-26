// Golden wire-compat harness. Pins the CURRENT (@fireproof/* 0.24.19) device-id
// token / CSR->cert / verify contract so the extracted @vibes.diy/identity impl
// can be proven equivalent. The cross-verification block at the bottom proves
// extracted-mints verify under the fireproof verifier and vice-versa, by routing
// the impl-under-test through `./identity-extracted-factories` — repoint those
// factories at the in-repo modules as each lift lands; the tests must stay green.
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
import { extracted } from "./identity-extracted-factories.js";

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

  // Regression for the Certor normalize-then-hash ordering (requested on #2667):
  // the cert thumbprint is computed AFTER CertificatePayloadSchema.parse fills the
  // patched `.catch("")` params defaults, so the issuing claim must be fully
  // populated or the signer's x5t (pre-parse) disagrees with the verifier's
  // (post-parse). Pin BOTH outcomes so a future extracted CA/verifier that drops
  // the normalize step is caught here. The extracted CA (Task 3) must preserve it.
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

    // Incomplete params (missing first/image_url/last/name) ⇒ schema fills them on
    // the verifier's re-parse ⇒ thumbprint mismatch.
    const incomplete = await mintWith({ email: "regr@example.com", email_verified: true, public_meta: "{}" });
    const vrBad = await verifier.verifyWithCertificate(incomplete);
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
    const vrGood = await verifier.verifyWithCertificate(full);
    expect(vrGood.valid).toBe(true);
    const header = decodeSeg(full.split(".")[0]);
    expect(header).toHaveProperty("x5t");
    expect(header).toHaveProperty("x5t#S256");
  });

  // --- Cross-verification gate -------------------------------------------------
  // The proof obligation every extraction step must keep green: a token minted by
  // the EXTRACTED impl verifies under the FIREPROOF verifier, and a fireproof-minted
  // token verifies under the EXTRACTED verifier. While the factories delegate to
  // fireproof (v1) these are tautological; they bite the moment a factory is
  // repointed at an in-repo module (a byte mismatch in the lifted crypto fails here).

  it("cross-verify: fireproof-minted token verifies under the extracted verifier", async () => {
    const tok = await user.getDashBoardToken();
    const caCert = (await ca.caCertificate()).Ok();
    const extractedVerifier = new extracted.DeviceIdVerifyMsg(sthis.txt.base64, [caCert], {
      clockTolerance: 0,
      deviceIdCA: ca,
    });
    const vr = await extractedVerifier.verifyWithCertificate(tok.token);
    expect(vr.valid).toBe(true);
    if (!vr.valid) throw new Error(String(vr.error));
    expect((vr.payload as { sub?: string }).sub).toBe("device-id");
  });

  it("cross-verify: extracted-minted token verifies under the fireproof verifier (byte-stable header+claims)", async () => {
    // Build the extracted signer from a publicly-issued cert (never from private
    // signer state): mint a key, run the CSR -> cert path, read the public
    // certificatePayload — the same field createDeviceIdGetToken reads from the keybag.
    const key = await extracted.DeviceIdKey.create();
    const csr = (await new DeviceIdCSR(sthis, key).createCSR({ commonName: "xverify-cn" })).Ok();
    // The verifier re-validates the cert's embedded Clerk claim, so issuance needs
    // the full claim shape (params/role/userId), mirroring createTestUser.
    const nowIssue = Math.floor(Date.now() / 1000);
    const issued = (
      await ca.processCSR(csr, {
        azp: "test-app-xverify",
        exp: nowIssue + 3600,
        iat: nowIssue,
        iss: "test-issuer",
        jti: "xverify-cert-jti",
        nbf: nowIssue,
        // Fully-populated params: CertificatePayloadSchema fills first/image_url/
        // last/name defaults on parse, and Certor hashes the cert AFTER parse, so an
        // under-specified claim makes the signer's x5t (pre-parse) disagree with the
        // verifier's (post-parse) → CERT_THUMBPRINT_MISMATCH. Supply every field.
        params: {
          nick: "nick-xverify",
          email: "xverify@example.com",
          email_verified: true,
          first: "first-xverify",
          image_url: "http://example.com/image-xverify.png",
          last: "last-xverify",
          name: "name-xverify",
          public_meta: '{ "role": "tester" }',
        },
        role: "device-id",
        sub: "device-id-subject-xverify",
        userId: "user-id-xverify",
        aud: ["http://test-audience.localhost/"],
      } as never)
    ).Ok();
    const signer = new extracted.DeviceIdSignMsg(sthis.txt.base64, key, issued.certificatePayload);
    const now = Math.floor(Date.now() / 1000);
    const token = await signer.sign(
      {
        iss: "wire-compat",
        sub: "device-id",
        deviceId: await key.fingerPrint(),
        seq: 1,
        exp: now + 120,
        nbf: now - 2,
        iat: now,
        jti: "xverify-jti",
      },
      "ES256"
    );
    const vr = await verifier.verifyWithCertificate(token);
    expect(vr.valid).toBe(true);
    if (!vr.valid) throw new Error(String(vr.error));
    const header = decodeSeg(token.split(".")[0]);
    expect(header.alg).toBe("ES256");
    for (const k of ["kid", "x5c", "x5t", "x5t#S256"]) expect(header).toHaveProperty(k);
    const payload = decodeSeg(token.split(".")[1]);
    expect(Object.keys(payload).sort()).toEqual(SESSION_CLAIM_KEYS);
  });
});
