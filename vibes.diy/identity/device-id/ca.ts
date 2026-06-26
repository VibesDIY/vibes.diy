// Lifted verbatim from @fireproof/core-device-id@0.24.19 `device-id-CA.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). The certificate authority:
// load CA key from a CA-json bundle (`from`), issue device certs from a validated
// CSR (`processCSR` -> `issueCertificate`), and emit the CA's own certificate
// (`caCertificate`). The signed cert payload shape + ES256 `CERT+JWT` header are
// the issuance wire contract. Imports only adjusted (DeviceIdKey/Validator/Certor
// are the in-repo lifts).
import { CertificatePayloadSchema, JWKPrivateSchema } from "@fireproof/core-types-base";
import type {
  BaseXXEndeCoder,
  Extensions,
  FPDeviceIDCSRPayload,
  IssueCertificateResult,
  JWKPublic,
  Subject,
  SuperThis,
  ClerkClaim,
} from "@fireproof/core-types-base";
import { SignJWT, jwtVerify } from "jose";
import { DeviceIdKey } from "./key.js";
import { DeviceIdValidator } from "./validator.js";
import { Certor } from "./certor.js";
import { Result, exception2Result } from "@adviser/cement";
import { hashObjectAsync } from "@fireproof/core-runtime";
import { base58btc } from "multiformats/bases/base58";
import type { CAActions, CACertResult, DeviceIdCAIf, DeviceIdCAJsonParam } from "@fireproof/core-types-device-id";

interface DeviceIdCAOpts {
  readonly base64: BaseXXEndeCoder;
  readonly caKey: DeviceIdKey;
  readonly caSubject: Subject;
  readonly actions: CAActions;
  readonly caChain?: string[];
  readonly validityPeriod?: number;
}
interface DeviceIdCAOptsDefaulted extends DeviceIdCAOpts {
  readonly validityPeriod: number;
  readonly caChain: string[];
}

function defaultDeviceIdCAOpts(opts: DeviceIdCAOpts): DeviceIdCAOptsDefaulted {
  return {
    ...opts,
    validityPeriod: opts.validityPeriod || 365 * 24 * 60 * 60,
    caChain: opts.caChain || [],
  };
}

export class DeviceIdCA implements DeviceIdCAIf {
  readonly #opts: DeviceIdCAOptsDefaulted;
  readonly #caKey: DeviceIdKey;
  readonly #caSubject: Subject;

  constructor(opts: DeviceIdCAOpts) {
    this.#opts = defaultDeviceIdCAOpts(opts);
    this.#caKey = opts.caKey;
    this.#caSubject = opts.caSubject;
  }

  static async from(sthis: SuperThis, caJson: DeviceIdCAJsonParam, actions: CAActions): Promise<Result<DeviceIdCA>> {
    let privateKey;
    if (typeof caJson.privateKey === "string") {
      const rPrivateKey = await exception2Result(async () => {
        const decoded = base58btc.decode(caJson.privateKey as string);
        const jsonString = sthis.txt.decode(decoded);
        return JSON.parse(jsonString);
      });
      if (rPrivateKey.isErr()) {
        return Result.Err(`Failed to decode privateKey: ${rPrivateKey.Err().message}`);
      }
      const parseResult = JWKPrivateSchema.safeParse(rPrivateKey.Ok());
      if (!parseResult.success) {
        return Result.Err(`Invalid private key format: ${parseResult.error.message}`);
      }
      privateKey = parseResult.data;
    } else {
      privateKey = caJson.privateKey;
    }
    const keyResult = await DeviceIdKey.createFromJWK(privateKey);
    if (keyResult.isErr()) {
      return Result.Err(`Failed to create DeviceIdKey: ${keyResult.Err().message}`);
    }
    const caKey = keyResult.Ok();
    const publicKeyResult = await exception2Result(async () => await caKey.publicKey());
    if (publicKeyResult.isErr()) {
      return Result.Err(`Failed to get public key: ${publicKeyResult.Err().message}`);
    }
    const publicKey = publicKeyResult.Ok();
    const verifyResult = await exception2Result(
      async () => await jwtVerify(caJson.signedCert, publicKey, { typ: "CERT+JWT", algorithms: ["ES256"] })
    );
    if (verifyResult.isErr()) {
      return Result.Err(`Certificate verification failed: ${verifyResult.Err().message}`);
    }
    const verified = verifyResult.Ok();
    const parseResult = CertificatePayloadSchema.safeParse(verified.payload);
    if (!parseResult.success) {
      return Result.Err(`Invalid certificate payload: ${parseResult.error.message}: ${JSON.stringify(verified.payload)}`);
    }
    const claims = parseResult.data;
    const caSubject = claims.certificate.issuer;
    const deviceCA = new DeviceIdCA({ base64: sthis.txt.base64, caKey, caSubject, actions });
    return Result.Ok(deviceCA);
  }

  getCAKey(): DeviceIdKey {
    return this.#caKey;
  }

  async processCSR(csrJWS: string, addition: ClerkClaim): Promise<Result<IssueCertificateResult>> {
    const validator = new DeviceIdValidator();
    const validation = await validator.validateCSR(csrJWS);
    if (!validation.valid) {
      return Result.Err(validation.error);
    }
    return this.issueCertificate({
      ...validation.payload,
      creatingUser: { type: "clerk", claims: addition },
    } as FPDeviceIDCSRPayload);
  }

  async caCertificate(): Promise<Result<CACertResult>> {
    const rCert = await this.issueCertificate({
      csr: { subject: this.#caSubject, publicKey: await this.#caKey.publicKey() },
    } as FPDeviceIDCSRPayload);
    if (rCert.isErr()) {
      return Result.Err(rCert);
    }
    return Result.Ok({
      certificate: Certor.fromUnverifiedJWT(this.#opts.base64, rCert.Ok().certificateJWT).asCert(),
      jwtStr: rCert.Ok().certificateJWT,
    } as CACertResult);
  }

  async issueCertificate(devId: FPDeviceIDCSRPayload): Promise<Result<IssueCertificateResult>> {
    const now = Math.floor(Date.now() / 1000);
    const serialNumber = await this.#opts.actions.generateSerialNumber(await this.#caKey.publicKey());
    const certificatePayload = {
      iss: this.#caSubject.commonName,
      sub: devId.csr.subject.commonName,
      aud: devId.aud || "certificate-users",
      iat: now,
      nbf: now,
      exp: now + this.#opts.validityPeriod,
      jti: serialNumber,
      creatingUser: devId.creatingUser,
      certificate: {
        version: "3",
        serialNumber: serialNumber,
        subject: devId.csr.subject,
        issuer: this.#caSubject,
        validity: {
          notBefore: new Date(now * 1000).toISOString(),
          notAfter: new Date((now + this.#opts.validityPeriod) * 1000).toISOString(),
        },
        subjectPublicKeyInfo: devId.csr.publicKey,
        signatureAlgorithm: "ES256",
        keyUsage: ["digitalSignature", "keyEncipherment"],
        extendedKeyUsage: ["serverAuth"],
      },
    };
    const pKey = await this.#caKey.exportPrivateJWK();
    const kid = await this.#caKey.fingerPrint();
    const certificateJWC = await new SignJWT(certificatePayload as Record<string, unknown>)
      .setProtectedHeader({ alg: "ES256", typ: "CERT+JWT", kid, x5c: this.#opts.caChain })
      .sign(pKey);
    return Result.Ok({
      certificateJWT: certificateJWC,
      certificatePayload: certificatePayload,
      format: "JWS",
      serialNumber: serialNumber,
      issuer: this.#caSubject.commonName,
      subject: devId.csr.subject.commonName,
      validityPeriod: {
        notBefore: new Date(now * 1000),
        notAfter: new Date((now + this.#opts.validityPeriod) * 1000),
      },
      publicKey: devId.csr.publicKey,
    } as unknown as IssueCertificateResult);
  }

  async buildCertificateExtensions(requestedExtensions: Extensions, subject: Subject, subjectPubKey: JWKPublic) {
    const extensions = {
      basicConstraints: { critical: true, cA: false, pathLenConstraint: null },
      keyUsage: { critical: true, usage: requestedExtensions.keyUsage || ["digitalSignature", "keyEncipherment"] },
      extendedKeyUsage: { critical: false, usage: requestedExtensions.extendedKeyUsage || ["serverAuth"] },
      subjectAltName: { critical: false, names: requestedExtensions.subjectAltName || [subject.commonName] },
      authorityKeyIdentifier: { keyIdentifier: await this.#caKey.fingerPrint() },
      subjectKeyIdentifier: { keyIdentifier: await hashObjectAsync(subjectPubKey) },
    };
    return extensions;
  }
}
