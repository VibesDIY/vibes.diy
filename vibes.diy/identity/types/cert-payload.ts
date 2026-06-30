// Owned cert-payload schemas (Task 5 — required to drop the patch).
//
// `CertificatePayloadSchema` embeds the Clerk claim (via `CreatingUserSchema`),
// and the upstream copy's leniency on the claim's profile fields comes ENTIRELY
// from `patches/@fireproof__core-types-base@0.24.19.patch`. Our device-id cert
// path (Certor / DeviceIdCA / DeviceIdVerifyMsg) parses certs through this schema,
// so to drop the patch without changing real-cert verification we own these here
// referencing the owned (lenient) `ClerkClaimSchema`. The non-Clerk sub-schemas
// (`SubjectSchema` / `ExtensionsSchema`) are NOT patched but are now ALSO owned
// in-repo (`./device-id-payload.js`, Task 6.3) so the cert path no longer imports
// a VALUE from `@fireproof/core-types-base`.
//
// Lifted verbatim from `core-types-base`'s `fp-ca-cert-payload.zod` /
// `fp-device-id-payload.zod` (`CreatingUserSchema`) @ 0.24.19, with only the
// Clerk-claim reference swapped to the owned schema.
import { z } from "zod";
import { SubjectSchema, ExtensionsSchema, type Subject, type Extensions } from "./device-id-payload.js";
import { JWKPublicSchema, type JWKPublic } from "./wire.js";
import { ClerkClaimSchema, type ClerkClaim } from "../clerk-claim.js";

// --- Owned cert-payload TYPES (#2937) -------------------------------------
// Hand-written to match the schemas below (the verbatim lift of
// `core-types-base`'s `fp-ca-cert-payload.zod` @ 0.24.19), as explicit types —
// not `z.infer` — so the emitted `.d.ts` names no zod-internal symbol (TS2883).
// `CertificatePayloadSchema` is `.readonly()` (top-level readonly); the embedded
// `Certificate` sub-schema is a plain `z.object` (mutable), matching upstream.
export interface Certificate {
  version: "3";
  serialNumber: string;
  subject: Subject;
  issuer: Subject;
  validity: { notBefore: string; notAfter: string };
  subjectPublicKeyInfo: JWKPublic;
  signatureAlgorithm: "ES256";
  keyUsage: (
    | "digitalSignature"
    | "nonRepudiation"
    | "keyEncipherment"
    | "dataEncipherment"
    | "keyAgreement"
    | "keyCertSign"
    | "cRLSign"
    | "encipherOnly"
    | "decipherOnly"
  )[];
  extendedKeyUsage: (
    | "serverAuth"
    | "clientAuth"
    | "codeSigning"
    | "emailProtection"
    | "timeStamping"
    | "OCSPSigning"
    | "ipsecIKE"
    | "msCodeInd"
    | "msCodeCom"
    | "msCTLSign"
    | "msEFS"
  )[];
  extensions?: Extensions;
}

export type CertificatePayload = Readonly<{
  iss: string;
  sub: string;
  aud: string | string[];
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
  certificate: Certificate;
  creatingUser?: { type: "clerk"; claims: ClerkClaim };
}>;

// `IssueCertificateResult` is the CA issuance result (reproduced from
// `core-types-base`'s `device-id.d.ts`); owned here alongside `CertificatePayload`
// which it embeds.
export interface IssueCertificateResult {
  readonly certificateJWT: string;
  readonly certificatePayload: CertificatePayload;
  readonly format: "JWS";
  readonly serialNumber: string;
  readonly issuer: string;
  readonly subject: string;
  readonly validityPeriod: { readonly notBefore: Date; readonly notAfter: Date };
  readonly publicKey: JWKPublic;
}

// `CreatingUserSchema` / `CertificateSchema` are internal building blocks for
// `CertificatePayloadSchema` (nothing imports them directly). They are NOT
// exported: their inferred Zod types reference zod-internal symbols by a
// pnpm-hashed path that can't be named portably in emitted `.d.ts` (TS2883), and
// only `CertificatePayloadSchema` — given an explicit named type below — needs to
// cross the package's declaration boundary.
const CreatingUserSchema = z.object({
  type: z.literal("clerk"),
  claims: ClerkClaimSchema,
});

const CertificateSchema = z.object({
  version: z.literal("3"),
  serialNumber: z.string(),
  subject: SubjectSchema,
  issuer: SubjectSchema,
  validity: z.object({
    notBefore: z.string().datetime(),
    notAfter: z.string().datetime(),
  }),
  subjectPublicKeyInfo: JWKPublicSchema,
  signatureAlgorithm: z.literal("ES256"),
  keyUsage: z.array(
    z.enum([
      "digitalSignature",
      "nonRepudiation",
      "keyEncipherment",
      "dataEncipherment",
      "keyAgreement",
      "keyCertSign",
      "cRLSign",
      "encipherOnly",
      "decipherOnly",
    ])
  ),
  extendedKeyUsage: z.array(
    z.enum([
      "serverAuth",
      "clientAuth",
      "codeSigning",
      "emailProtection",
      "timeStamping",
      "OCSPSigning",
      "ipsecIKE",
      "msCodeInd",
      "msCodeCom",
      "msCTLSign",
      "msEFS",
    ])
  ),
  extensions: ExtensionsSchema.optional(),
});

// Annotated with the upstream `CertificatePayload` type (the verbatim shape this
// schema was lifted from) so tsc emits a portable, nameable declaration instead
// of inlining the zod-internal types (TS2883). The annotation is type-only; the
// runtime schema keeps the owned lenient `ClerkClaimSchema` behavior. Consumers
// (`Certor`, `DeviceIdCA`) only call `.parse`/`.safeParse`, which `z.ZodType`
// provides.
export const CertificatePayloadSchema: z.ZodType<CertificatePayload> = z
  .object({
    iss: z.string(),
    sub: z.string(),
    aud: z.string().or(z.array(z.string())),
    iat: z.number().int(),
    nbf: z.number().int(),
    exp: z.number().int(),
    jti: z.string(),
    certificate: CertificateSchema,
    creatingUser: CreatingUserSchema.optional(),
  })
  .readonly() as z.ZodType<CertificatePayload>;
