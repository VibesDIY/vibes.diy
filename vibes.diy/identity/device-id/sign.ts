// Lifted from @fireproof/core-device-id@0.24.19 `device-id-signed-msg.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). Signs an FPDeviceIDSession
// claim set as an ES256 JWT carrying the cert-chain headers (kid/x5c/x5t/x5t#S256).
// The header field set + ordering and the Certor-derived x5c/x5t are the byte-level
// wire contract — proven identical to upstream by the cross-verification harness.
//
// SECURITY (#2671): the optional `certificateJWT` arg adds an extra protected
// header `x5c#jwt` carrying the CA-signed `CERT+JWT` for the embedded cert, so the
// verifier can check the cert was actually signed by the CA's key (not merely that
// its `iss` string names the CA). The keybag already stores this JWT alongside the
// payload, so no re-login is needed. When the arg is omitted the header is
// byte-identical to upstream (the legacy, CA-unverified wire shape), which keeps
// the cross-verification harness green and lets older tokens keep flowing during
// the rollout — the verifier only *requires* `x5c#jwt` once enforcement is enabled.
import { calculateJwkThumbprint, SignJWT, type JWTHeaderParameters, type JWTPayload as JoseJWTPayload } from "jose";
import type { BaseXXEndeCoder, CertificatePayload, JWTPayload } from "@fireproof/core-types-base";
import { Certor } from "./certor.js";
import { DeviceIdKey } from "./key.js";

export class DeviceIdSignMsg {
  readonly #key: DeviceIdKey;
  readonly #cert: CertificatePayload;
  readonly #certificateJWT?: string;
  readonly base64: BaseXXEndeCoder;

  constructor(base64: BaseXXEndeCoder, key: DeviceIdKey, cert: CertificatePayload, certificateJWT?: string) {
    this.#key = key;
    this.#cert = cert;
    this.#certificateJWT = certificateJWT;
    this.base64 = base64;
  }

  async sign<T extends JWTPayload>(payload: T, algorithm = "ES256"): Promise<string> {
    const certor = new Certor(this.base64, this.#cert);
    const x5c = [certor.asBase64()];
    const x5t = await certor.asSHA1();
    const x5tS256 = await certor.asSHA256();
    const protectedHeader: JWTHeaderParameters = {
      alg: algorithm,
      typ: "JWT",
      kid: await calculateJwkThumbprint(await this.#key.publicKey(), "sha256"),
      x5c: x5c,
      x5t: x5t,
      "x5t#S256": x5tS256,
    };
    // #2671: carry the CA-signed cert chain so the verifier can validate the CA
    // signature. Appended last so the header stays byte-identical to upstream when
    // omitted (the cross-verification harness pins that equality).
    if (this.#certificateJWT) {
      protectedHeader["x5c#jwt"] = this.#certificateJWT;
    }
    return await new SignJWT(payload as JoseJWTPayload)
      .setProtectedHeader(protectedHeader)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(await this.#key.exportPrivateJWK());
  }
}
