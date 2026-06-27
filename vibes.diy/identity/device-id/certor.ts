// Lifted verbatim from @fireproof/core-device-id@0.24.19 `certor.js` (upstream
// tag fireproof-storage/fireproof@v0.24.19). Serializes a certificate payload to
// a canonical (sorted) JSON form and derives its SHA-1 / SHA-256 thumbprints —
// the x5c / x5t / x5t#S256 wire bytes. CRITICAL: hashing happens AFTER
// CertificatePayloadSchema.parse normalizes the cert (filling the patched
// `.catch("")` params defaults), so this normalize-then-hash order is load-bearing
// for thumbprint equality (pinned by the wire-compat harness). Imports only adjusted.
import { toSortedObject } from "@adviser/cement";
import { CertificatePayloadSchema } from "../types/cert-payload.js";
import type { BaseXXEndeCoder, CertificatePayload } from "@fireproof/core-types-base";
import type { CertorIf } from "@fireproof/core-types-device-id";
import { decodeJwt } from "jose";
import { base58btc } from "multiformats/bases/base58";
import { sha1 } from "multiformats/hashes/sha1";
import { sha256 } from "multiformats/hashes/sha2";
import { deepFreeze } from "@fireproof/core-runtime";

export class Certor implements CertorIf {
  readonly #cert: CertificatePayload;
  readonly base64: BaseXXEndeCoder;
  #strCert?: string;
  #uint8Cert?: Uint8Array;

  static fromString(base64: BaseXXEndeCoder, cert: string): Certor {
    const certObj = CertificatePayloadSchema.parse(JSON.parse(base64.decode(cert)));
    return new Certor(base64, certObj);
  }

  static fromUnverifiedJWT(base64: BaseXXEndeCoder, jwtString: string): Certor {
    const payload = decodeJwt(jwtString);
    const certObj = CertificatePayloadSchema.parse(payload);
    return new Certor(base64, certObj);
  }

  constructor(base64: BaseXXEndeCoder, cert: CertificatePayload) {
    this.#cert = deepFreeze(toSortedObject(cert)) as CertificatePayload;
    this.base64 = base64;
  }

  asCert(): CertificatePayload {
    return this.#cert;
  }

  parseCertificateSubject(s: string): Record<string, string> {
    const parts: Record<string, string> = {};
    s.split(",").forEach((part) => {
      const [key, value] = part.trim().split("=");
      if (key && value) {
        parts[key] = value;
      }
    });
    return parts;
  }

  async asSHA1(): Promise<string> {
    this.#uint8Cert ||= this.base64.decodeUint8(this.asBase64());
    const val = await sha1.digest(this.#uint8Cert);
    return base58btc.encode(val.bytes);
  }

  async asSHA256(): Promise<string> {
    this.#uint8Cert ||= this.base64.decodeUint8(this.asBase64());
    const val = await sha256.digest(this.#uint8Cert);
    return base58btc.encode(val.bytes);
  }

  asBase64(): string {
    this.#strCert ||= this.base64.encode(JSON.stringify(toSortedObject(this.#cert)));
    return this.#strCert;
  }
}
