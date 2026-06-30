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
import * as sts from "../sts/index.js";
import type { BaseXXEndeCoder } from "../types/sthis.js";
import type { CertificatePayload } from "../types/cert-payload.js";
import type {
  CACertResult,
  HeaderCertInfo,
  VerifyWithCertificateError,
  VerifyWithCertificateOptions,
  VerifyWithCertificateResult,
} from "../types/device-id-types.js";

// #2671: extra option (intersected onto the upstream type, which we can't edit)
// that turns the CA-signature *presence* requirement on. When false/absent the
// verifier still validates an `x5c#jwt` chain signature if the token carries one,
// but won't reject a legacy token that omits it — so older published CLIs keep
// authenticating until the flag is flipped after the new CLI is rolled out.
type DeviceIdVerifyOptions = VerifyWithCertificateOptions & { readonly requireCASignature?: boolean };

export class DeviceIdVerifyMsg {
  readonly #base64: BaseXXEndeCoder;
  readonly #trustedCAs: CertificatePayload[];
  readonly #options: DeviceIdVerifyOptions;

  constructor(base64: BaseXXEndeCoder, trustedCAs: CACertResult[], options: DeviceIdVerifyOptions) {
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
    let jwtPayload: unknown = jwtVerification.payload;
    const jwtHeader: unknown = jwtVerification.protectedHeader;
    const rCertValidation = await this.validateCertificate(certInfo.certificate);
    if (rCertValidation.isErr()) {
      return this.createVerifyWithCertificateError(rCertValidation, {
        certificateExtracted: true,
        certificateInfo: certInfo,
        jwtSignatureValid: true,
      }) as VerifyWithCertificateResult<S>;
    }
    // #2671: prove the embedded cert was actually signed by the trusted CA's key,
    // not just that its `iss` string names the CA. validateCertificate above only
    // does the (forgeable) issuer-NAME match; this verifies the CA signature.
    const rChain = await this.validateCertificateChainSignature(certInfo);
    if (rChain.isErr()) {
      return this.createVerifyWithCertificateError(rChain, {
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
      const trustedCA: CertificatePayload | null = this.findTrustedCA(cert, this.#trustedCAs) ?? null;
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

  // #2671: verify the embedded device cert was genuinely issued by the trusted CA,
  // by checking the CA's ES256 signature over the cert chain — closing the
  // auth-bypass where a client forges a self-issued cert that merely *names* the CA
  // as `iss` and embeds its own key.
  //
  // The token carries the CA-signed cert as a `CERT+JWT` in the `x5c#jwt` protected
  // header (the keybag already stores it). We `jwtVerify` it against the trusted
  // CA's public key (taken from the CA cert payload the verifier was constructed
  // with), then confirm the CA-signed cert is byte-identical (post-normalize) to the
  // `x5c[0]` cert whose key signed the token — so a forger can neither omit it (with
  // enforcement on) nor splice a real CA-signed cert over a different device key.
  async validateCertificateChainSignature(certInfo: HeaderCertInfo): Promise<Result<true>> {
    const caJwt = (certInfo as unknown as { rawHeader?: Record<string, unknown> }).rawHeader?.["x5c#jwt"];
    if (typeof caJwt !== "string" || caJwt.length === 0) {
      if (this.#options.requireCASignature) {
        return Result.Err(new Error("Certificate not trusted: missing CA chain signature (x5c#jwt)"));
      }
      // Rollout transition: legacy token without a chain signature. Accept only
      // because enforcement is off; the issuer-name + validity checks already ran.
      return Result.Ok(true);
    }
    const cert = certInfo.certificate.asCert();
    const trustedCA = this.findTrustedCA(cert, this.#trustedCAs);
    if (!trustedCA) {
      return Result.Err(new Error("Certificate not issued by a trusted CA"));
    }
    const rCaKey = await sts.importJWK(trustedCA.certificate.subjectPublicKeyInfo, "ES256");
    if (rCaKey.isErr()) {
      return Result.Err(rCaKey.Err());
    }
    const rVerified = await exception2Result(() => jwtVerify(caJwt, rCaKey.Ok().key, { typ: "CERT+JWT", algorithms: ["ES256"] }));
    if (rVerified.isErr()) {
      return Result.Err(new Error(`Certificate CA-signature verification failed: ${rVerified.Err().message}`));
    }
    // The CA signed THIS exact cert payload — bind it to the cert that actually
    // verified the token (x5c[0]), so a real CA-signed cert can't be spliced onto a
    // forged device key. Certor normalizes (sort) both, matching the signer's x5c.
    const signedCert = Certor.fromUnverifiedJWT(this.#base64, caJwt);
    if (signedCert.asBase64() !== certInfo.certificate.asBase64()) {
      return Result.Err(new Error("Certificate not trusted: CA-signed cert does not match embedded certificate"));
    }
    return Result.Ok(true);
  }

  getErrorCode(ierror: unknown): VerifyWithCertificateError["errorCode"] {
    const { message: errorMessage } = ierror as { message: string };
    if (errorMessage.includes("thumbprint mismatch")) return "CERT_THUMBPRINT_MISMATCH";
    if (errorMessage.includes("expired")) return "CERT_EXPIRED";
    if (errorMessage.includes("not yet valid")) return "CERT_NOT_YET_VALID";
    if (errorMessage.includes("self-signed")) return "CERT_SELF_SIGNED";
    if (errorMessage.includes("not trusted")) return "CERT_NOT_TRUSTED";
    if (errorMessage.includes("CA-signature")) return "CERT_NOT_TRUSTED";
    if (errorMessage.includes("revoked")) return "CERT_REVOKED";
    if (errorMessage.includes("signature verification failed")) return "JWT_SIGNATURE_INVALID";
    if (errorMessage.includes("No certificate")) return "CERT_NOT_FOUND";
    return "VERIFICATION_FAILED";
  }
}
