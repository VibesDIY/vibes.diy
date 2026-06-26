// Lifted verbatim from @fireproof/core-device-id@0.24.19 `device-id-signed-msg.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). Signs an FPDeviceIDSession
// claim set as an ES256 JWT carrying the cert-chain headers (kid/x5c/x5t/x5t#S256).
// The header field set + ordering and the Certor-derived x5c/x5t are the byte-level
// wire contract — proven identical to upstream by the cross-verification harness.
import { calculateJwkThumbprint, SignJWT, type JWTPayload as JoseJWTPayload } from "jose";
import type { BaseXXEndeCoder, CertificatePayload, JWTPayload } from "@fireproof/core-types-base";
import { Certor } from "./certor.js";
import { DeviceIdKey } from "./key.js";

export class DeviceIdSignMsg {
  readonly #key: DeviceIdKey;
  readonly #cert: CertificatePayload;
  readonly base64: BaseXXEndeCoder;

  constructor(base64: BaseXXEndeCoder, key: DeviceIdKey, cert: CertificatePayload) {
    this.#key = key;
    this.#cert = cert;
    this.base64 = base64;
  }

  async sign<T extends JWTPayload>(payload: T, algorithm = "ES256"): Promise<string> {
    const certor = new Certor(this.base64, this.#cert);
    const x5c = [certor.asBase64()];
    const x5t = await certor.asSHA1();
    const x5tS256 = await certor.asSHA256();
    return await new SignJWT(payload as JoseJWTPayload)
      .setProtectedHeader({
        alg: algorithm,
        typ: "JWT",
        kid: await calculateJwkThumbprint(await this.#key.publicKey(), "sha256"),
        x5c: x5c,
        x5t: x5t,
        "x5t#S256": x5tS256,
      })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(await this.#key.exportPrivateJWK());
  }
}
