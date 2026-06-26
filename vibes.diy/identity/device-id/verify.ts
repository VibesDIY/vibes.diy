// Lifted verbatim from @fireproof/core-device-id@0.24.19 `device-id-verify-msg.js`
// (upstream tag fireproof-storage/fireproof@v0.24.19). Server-side device-token
// verifier: extracts the x5c cert chain, checks the SHA-1/256 thumbprints, jose-
// verifies the JWT against the cert's public key, validates the cert's validity
// window + trusted-CA issuer, then optionally schema-parses the payload. Imports
// only adjusted (Certor is the in-repo lift). The error codes + validation order
// are the wire contract proven by the cross-verification harness.
import { jwtVerify, decodeProtectedHeader } from "jose";
import { Certor } from "./certor.js";
import { exception2Result, Result } from "@adviser/cement";
import { sts } from "@fireproof/core-runtime";
import type { BaseXXEndeCoder, CertificatePayload } from "@fireproof/core-types-base";
import type {
  CACertResult,
  HeaderCertInfo,
  VerifyWithCertificateError,
  VerifyWithCertificateOptions,
  VerifyWithCertificateResult,
} from "@fireproof/core-types-device-id";

export class DeviceIdVerifyMsg {
  readonly #base64: BaseXXEndeCoder;
  readonly #trustedCAs: CertificatePayload[];
  readonly #options: VerifyWithCertificateOptions;

  constructor(base64: BaseXXEndeCoder, trustedCAs: CACertResult[], options: VerifyWithCertificateOptions) {
    this.#base64 = base64;
    this.#trustedCAs = trustedCAs.map((ca) => ca.certificate);
    this.#options = options;
  }

  createVerifyWithCertificateError(
    error: Result<unknown>,
    partialResults: Partial<VerifyWithCertificateError["partialResults"]> = {}
  ): VerifyWithCertificateError {
    return {
      valid: false,
      error: error.Err(),
      errorCode: this.getErrorCode(error.Err()),
      partialResults: {
        certificateExtracted: partialResults.certificateExtracted ?? false,
        jwtSignatureValid: partialResults.jwtSignatureValid ?? false,
        certificateInfo: partialResults.certificateInfo,
      },
      verificationTimestamp: new Date().toISOString(),
    };
  }

  async verifyWithCertificate<S>(jwt: string, schema?: S): Promise<VerifyWithCertificateResult<S>> {
    let certInfo: HeaderCertInfo | undefined = undefined;
    let jwtPayload: unknown = null;
    let jwtHeader: unknown = null;
    const rCertInfo = this.extractCertificateFromJWT(jwt);
    if (rCertInfo.isErr()) {
      return this.createVerifyWithCertificateError(rCertInfo) as VerifyWithCertificateResult<S>;
    }
    certInfo = rCertInfo.Ok();
    const rThumbprint = await this.validateCertificateThumbprint(certInfo);
    if (rThumbprint.isErr()) {
      return this.createVerifyWithCertificateError(rThumbprint, {
        certificateExtracted: true,
        certificateInfo: certInfo,
      }) as VerifyWithCertificateResult<S>;
    }
    if (!rThumbprint.Ok()) {
      return this.createVerifyWithCertificateError(Result.Err("Certificate thumbprint validation failed"), {
        certificateExtracted: true,
        certificateInfo: certInfo,
      }) as VerifyWithCertificateResult<S>;
    }
    const rVerify = await exception2Result(async () => {
      const rKey = await sts.importJWK(certInfo.certificate.asCert().certificate.subjectPublicKeyInfo, certInfo.algorithm);
      if (rKey.isErr()) {
        throw rKey.Err();
      }
      return jwtVerify(jwt, rKey.Ok().key, {
        clockTolerance: this.#options.clockTolerance,
        maxTokenAge: this.#options.maxAge,
      });
    });
    if (rVerify.isErr()) {
      return this.createVerifyWithCertificateError(rVerify, {
        certificateExtracted: true,
        certificateInfo: certInfo,
      }) as VerifyWithCertificateResult<S>;
    }
    const jwtVerification = rVerify.Ok();
    if (!jwtVerification) {
      return this.createVerifyWithCertificateError(Result.Err("JWT verification failed"), {
        certificateExtracted: true,
        certificateInfo: certInfo,
      }) as VerifyWithCertificateResult<S>;
    }
    jwtPayload = jwtVerification.payload;
    jwtHeader = jwtVerification.protectedHeader;
    const rCertValidation = await this.validateCertificate(certInfo.certificate);
    if (rCertValidation.isErr()) {
      return this.createVerifyWithCertificateError(rCertValidation, {
        certificateExtracted: true,
        certificateInfo: certInfo,
        jwtSignatureValid: true,
      }) as VerifyWithCertificateResult<S>;
    }
    if (certInfo.certificateChain.length > 1) {
      return this.createVerifyWithCertificateError(Result.Err("Certificate chain validation not implemented"), {
        certificateExtracted: true,
        certificateInfo: certInfo,
      }) as VerifyWithCertificateResult<S>;
    }
    if (schema) {
      const rPayloadParse = (
        schema as unknown as { safeParse(d: unknown): { success: boolean; data?: unknown; error?: unknown } }
      ).safeParse(jwtPayload);
      if (!rPayloadParse.success) {
        return this.createVerifyWithCertificateError(Result.Err(rPayloadParse.error as Error), {
          certificateExtracted: true,
          certificateInfo: certInfo,
          jwtSignatureValid: true,
        }) as VerifyWithCertificateResult<S>;
      }
      jwtPayload = rPayloadParse.data;
    }
    return {
      valid: true,
      payload: jwtPayload,
      header: jwtHeader,
      certificate: {
        ...certInfo,
        validation: rCertValidation.Ok(),
        publicKey: certInfo.certificate.asCert().certificate.subjectPublicKeyInfo,
      },
      verificationTimestamp: new Date().toISOString(),
    } as VerifyWithCertificateResult<S>;
  }

  extractCertificateFromJWT(jwt: string): Result<HeaderCertInfo> {
    return exception2Result(() => {
      const header = decodeProtectedHeader(jwt);
      if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
        throw new Error("No certificate chain (x5c) found in JWT header");
      }
      const certificateChain = header.x5c.map((cert) => Certor.fromString(this.#base64, cert));
      const mainCertificate = certificateChain[0];
      return {
        certificate: mainCertificate,
        certificateChain: certificateChain,
        thumbprint: header.x5t,
        thumbprintSha256: header["x5t#S256"],
        keyId: header.kid,
        algorithm: header.alg,
        certificateUrl: header.x5u,
        rawHeader: header,
      } as unknown as HeaderCertInfo;
    });
  }

  async validateCertificateThumbprint(certInfo: HeaderCertInfo): Promise<Result<boolean>> {
    if (certInfo.thumbprint) {
      const calculatedThumbprint = await certInfo.certificate.asSHA1();
      if (certInfo.thumbprint !== calculatedThumbprint) {
        return Result.Err(new Error("Certificate SHA-1 thumbprint mismatch - certificate may have been tampered with"));
      }
    }
    if (certInfo.thumbprintSha256) {
      const calculatedThumbprintSha256 = await certInfo.certificate.asSHA256();
      if (certInfo.thumbprintSha256 !== calculatedThumbprintSha256) {
        return Result.Err(new Error("Certificate SHA-256 thumbprint mismatch - certificate may have been tampered with"));
      }
    }
    return Result.Ok(true);
  }

  async validateCertificate(certor: HeaderCertInfo["certificate"]): Promise<Result<unknown>> {
    const now = new Date();
    return exception2Result(() => {
      const cert = certor.asCert();
      const subject = certor.parseCertificateSubject(cert.sub);
      const issuer = certor.parseCertificateSubject(cert.iss);
      const notBefore = new Date(cert.nbf * 1000);
      const notAfter = new Date(cert.exp * 1000);
      if (notBefore > now) {
        throw new Error(`Certificate is not yet valid (valid from: ${notBefore.toISOString()})`);
      }
      if (notAfter < now) {
        throw new Error(`Certificate has expired (valid to: ${notAfter.toISOString()})`);
      }
      let trustedCA: CertificatePayload | null = null;
      trustedCA = this.findTrustedCA(cert, this.#trustedCAs) ?? null;
      if (!trustedCA) {
        throw new Error("Certificate not issued by a trusted CA");
      }
      return {
        valid: true,
        subject: subject,
        issuer: issuer,
        serialNumber: cert.certificate.serialNumber,
        notBefore: notBefore,
        notAfter: notAfter,
        publicKey: cert.certificate.subjectPublicKeyInfo,
        trustedCA: trustedCA,
        validityPeriod: {
          days: Math.floor((notAfter.getTime() - notBefore.getTime()) / (1000 * 60 * 60 * 24)),
        },
      };
    });
  }

  findTrustedCA(cert: CertificatePayload, trustedCAs: CertificatePayload[]): CertificatePayload | undefined {
    return trustedCAs.find((trustedCA) => {
      try {
        return cert.iss === trustedCA.sub;
      } catch {
        return false;
      }
    });
  }

  getErrorCode(ierror: unknown): VerifyWithCertificateError["errorCode"] {
    const { message: errorMessage } = ierror as { message: string };
    if (errorMessage.includes("thumbprint mismatch")) return "CERT_THUMBPRINT_MISMATCH";
    if (errorMessage.includes("expired")) return "CERT_EXPIRED";
    if (errorMessage.includes("not yet valid")) return "CERT_NOT_YET_VALID";
    if (errorMessage.includes("self-signed")) return "CERT_SELF_SIGNED";
    if (errorMessage.includes("not trusted")) return "CERT_NOT_TRUSTED";
    if (errorMessage.includes("revoked")) return "CERT_REVOKED";
    if (errorMessage.includes("signature verification failed")) return "JWT_SIGNATURE_INVALID";
    if (errorMessage.includes("No certificate")) return "CERT_NOT_FOUND";
    return "VERIFICATION_FAILED";
  }
}
