// Owned device-id protocol interfaces (#2937 — drop `@fireproof/core-types-device-id`).
//
// Reproduced verbatim (erasable interfaces only) from `@fireproof/core-types-device-id`'s
// `index.d.ts` @ 0.24.19 (upstream tag fireproof-storage/fireproof@v0.24.19) — the
// CA / certor / key / verify-result contract the in-repo device-id crypto
// (`../device-id/*`) implements. The upstream package is type-only (its `index.js`
// is `export {}`), so this is a pure type lift with no runtime artifact; the
// implementations were already in-sourced and proven byte/behavior-identical by
// the cross-verification + golden-vector harness.
//
// `CertificatePayload` / `IssueCertificateResult` / `JWKPublic` / `JWKPrivate` /
// `ClerkClaim` are sourced from the owned in-repo modules so this module imports
// no `@fireproof/*` type.
import type { Result } from "@adviser/cement";
import type { z } from "zod";
import type { CertificatePayload, IssueCertificateResult } from "./cert-payload.js";
import type { JWKPublic, JWKPrivate } from "./wire.js";
import type { ClerkClaim } from "../clerk-claim.js";

export interface CAActions {
  generateSerialNumber(pub: JWKPublic): Promise<string>;
}

export interface DeviceIdCAJsonParam {
  readonly privateKey: JWKPrivate | string;
  readonly signedCert: string;
}

export interface CACertResult {
  readonly certificate: CertificatePayload;
  readonly jwtStr: string;
}

export interface DeviceIdTransport {
  issueCertificate(csrJWT: string): Promise<Result<IssueCertificateResult>>;
}

export interface DeviceIdProtocol {
  issueCertificate(msg: string): Promise<Result<IssueCertificateResult>>;
  verifyMsg<S>(message: string, schema?: S): Promise<VerifyWithCertificateResult<S>>;
}

export interface DeviceIdProtocolSrvOpts {
  readonly actions: CAActions;
}

export interface CertorIf {
  asCert(): CertificatePayload;
  parseCertificateSubject(s: string): Record<string, string>;
  asSHA1(): Promise<string>;
  asSHA256(): Promise<string>;
  asBase64(): string;
}

export interface HeaderCertInfo {
  readonly certificate: CertorIf;
  readonly certificateChain: CertorIf[];
  readonly thumbprint?: string;
  readonly thumbprintSha256?: string;
  readonly keyId?: string;
  readonly algorithm?: string;
  readonly certificateUrl?: string;
  readonly rawHeader: unknown;
}

export interface VerifyWithCertificateSuccess<T = unknown> {
  readonly valid: true;
  readonly payload: T;
  readonly header: unknown;
  readonly certificate: HeaderCertInfo & {
    readonly validation: {
      readonly valid: true;
      readonly subject: Record<string, string>;
      readonly issuer: Record<string, string>;
      readonly serialNumber: string;
      readonly notBefore: Date;
      readonly notAfter: Date;
      readonly publicKey: JWKPublic;
      readonly trustedCA?: CertificatePayload;
      readonly validityPeriod: { readonly days: number };
    };
    readonly publicKey: JWKPublic;
  };
  readonly verificationTimestamp: string;
}

export interface VerifyWithCertificateError {
  readonly valid: false;
  readonly error: Error;
  readonly errorCode: string;
  readonly partialResults: {
    readonly certificateExtracted: boolean;
    readonly jwtSignatureValid: boolean;
    readonly certificateInfo?: HeaderCertInfo;
  };
  readonly verificationTimestamp: string;
}

export type VerifyWithCertificateResult<T> =
  | VerifyWithCertificateSuccess<T extends z.ZodTypeAny ? z.infer<T> : unknown>
  | VerifyWithCertificateError;

export interface VerifyWithCertificateOptions {
  readonly clockTolerance: number;
  readonly maxAge?: number;
  readonly deviceIdCA: DeviceIdCAIf;
}

export interface DeviceIdKeyIf {
  fingerPrint(): Promise<string>;
  exportPrivateJWK(): Promise<JWKPrivate>;
  publicKey(): Promise<JWKPublic>;
}

export interface DeviceIdCAIf {
  getCAKey(): DeviceIdKeyIf;
  processCSR(csrJWS: string, addition: ClerkClaim): Promise<Result<IssueCertificateResult>>;
  caCertificate(): Promise<Result<CACertResult>>;
  issueCertificate(devId: unknown): Promise<Result<IssueCertificateResult>>;
}
