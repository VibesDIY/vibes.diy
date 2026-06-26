// Lifted verbatim from @fireproof/core-device-id@0.24.19 `device-id-CSR.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). Builds and ES256-signs a
// certificate-signing-request JWS the CA consumes. Imports only adjusted; the CSR
// payload shape and header are the enrollment wire contract.
import { calculateJwkThumbprint, SignJWT, type JWTPayload as JoseJWTPayload } from "jose";
import { FPDeviceIDCSRPayloadSchema } from "@fireproof/core-types-base";
import type { Subject, Extensions, FPDeviceIDCSRPayload, SuperThis } from "@fireproof/core-types-base";
import { exception2Result, Result } from "@adviser/cement";
import { DeviceIdKey } from "./key.js";

export class DeviceIdCSR {
  readonly #key: DeviceIdKey;
  readonly #sthis: SuperThis;

  constructor(sthis: SuperThis, key: DeviceIdKey) {
    this.#key = key;
    this.#sthis = sthis;
  }

  async createCSRPayload(subject: Subject, extensions: Partial<Extensions> = {}): Promise<FPDeviceIDCSRPayload> {
    const now = Math.floor(Date.now() / 1000);
    return FPDeviceIDCSRPayloadSchema.parse({
      sub: subject.commonName,
      iss: "csr-client",
      aud: "certificate-authority",
      iat: now,
      exp: now + 3600,
      jti: this.#sthis.nextId(16).str,
      csr: {
        subject: subject,
        publicKey: await this.#key.publicKey(),
        extensions: {
          subjectAltName: extensions.subjectAltName || [],
          keyUsage: extensions.keyUsage || ["digitalSignature", "keyEncipherment"],
          extendedKeyUsage: extensions.extendedKeyUsage || ["serverAuth"],
        },
      },
    });
  }

  async signCSR(payload: FPDeviceIDCSRPayload): Promise<Result<string>> {
    return exception2Result(async () => {
      const publicJWK = await this.#key.publicKey();
      const jws = await new SignJWT(payload as JoseJWTPayload)
        .setProtectedHeader({
          alg: "ES256",
          typ: "CSR+JWT",
          jwk: publicJWK,
          kid: await calculateJwkThumbprint(publicJWK, "sha256"),
        })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(await this.#key.exportPrivateJWK());
      return jws;
    });
  }

  async createCSR(subject: Subject, extensions: Partial<Extensions> = {}): Promise<Result<string, Error>> {
    const payload = await this.createCSRPayload(subject, extensions);
    return this.signCSR(payload);
  }
}
