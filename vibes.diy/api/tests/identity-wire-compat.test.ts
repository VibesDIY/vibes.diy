// Golden wire-compat harness. Pins the CURRENT (@fireproof/* 0.24.19) device-id
// token / CSR->cert / verify contract so the extracted @vibes.diy/identity impl
// can be proven equivalent. A later phase extends this with cross-verification
// (extracted-mints verify under the fireproof verifier and vice-versa) by
// swapping the mint/verify factories below for the extracted ones.
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
});
