// Owned cert-payload schemas (Task 5 — required to drop the patch).
//
// `CertificatePayloadSchema` embeds the Clerk claim (via `CreatingUserSchema`),
// and the upstream copy's leniency on the claim's profile fields comes ENTIRELY
// from `patches/@fireproof__core-types-base@0.24.19.patch`. Our device-id cert
// path (Certor / DeviceIdCA / DeviceIdVerifyMsg) parses certs through this schema,
// so to drop the patch without changing real-cert verification we own these here
// referencing the owned (lenient) `ClerkClaimSchema`. The non-Clerk sub-schemas
// (`SubjectSchema` / `ExtensionsSchema`) are NOT patched and stay upstream-sourced.
//
// Lifted verbatim from `core-types-base`'s `fp-ca-cert-payload.zod` /
// `fp-device-id-payload.zod` (`CreatingUserSchema`) @ 0.24.19, with only the
// Clerk-claim reference swapped to the owned schema.
import { z } from "zod";
import { SubjectSchema, ExtensionsSchema } from "@fireproof/core-types-base";
import type { Subject, Extensions, JWKPublic } from "@fireproof/core-types-base";
import { JWKPublicSchema } from "./wire.js";
import { ClerkClaimSchema } from "../clerk-claim.js";
import type { ClerkClaim } from "../clerk-claim.js";

export const CreatingUserSchema = z.object({
  type: z.literal("clerk"),
  claims: ClerkClaimSchema,
});

// `CertificateSchema` / `CertificatePayloadSchema` compose schemas imported from
// `@fireproof/core-types-base` (`SubjectSchema` / `ExtensionsSchema`), so their
// inferred Zod types cannot be emitted to `.d.ts` portably (TS2883 — the names
// resolve through a non-portable `.pnpm/zod@.../v4` path). We keep the raw
// schemas internal so their un-nameable types never cross the declaration
// boundary, hand-write the output shapes from the plain types those packages
// already export (below), and export the schemas annotated as `z.ZodType<…>`.
// Runtime behavior is unchanged — `.parse` / `.safeParse` still return the shape.
const certificateSchema = z.object({
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

const certificatePayloadSchema = z
  .object({
    iss: z.string(),
    sub: z.string(),
    aud: z.string().or(z.array(z.string())),
    iat: z.number().int(),
    nbf: z.number().int(),
    exp: z.number().int(),
    jti: z.string(),
    certificate: certificateSchema,
    creatingUser: CreatingUserSchema.optional(),
  })
  .readonly();

// Explicit output shapes (no `typeof <schema>` references) so declaration emit
// stays portable. Built from the plain types `core-types-base` / wire.ts already
// export. These must mirror the schemas above; the assignment below is what pins
// them — if a schema field drifts from its type, `z.ZodType<…> = …` fails to compile.
export type KeyUsage =
  | "digitalSignature"
  | "nonRepudiation"
  | "keyEncipherment"
  | "dataEncipherment"
  | "keyAgreement"
  | "keyCertSign"
  | "cRLSign"
  | "encipherOnly"
  | "decipherOnly";

export type ExtendedKeyUsage =
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
  | "msEFS";

export interface CreatingUser {
  type: "clerk";
  claims: ClerkClaim;
}

export interface Certificate {
  version: "3";
  serialNumber: string;
  subject: Subject;
  issuer: Subject;
  validity: { notBefore: string; notAfter: string };
  subjectPublicKeyInfo: JWKPublic;
  signatureAlgorithm: "ES256";
  keyUsage: KeyUsage[];
  extendedKeyUsage: ExtendedKeyUsage[];
  extensions?: Extensions;
}

export interface CertificatePayload {
  readonly iss: string;
  readonly sub: string;
  readonly aud: string | string[];
  readonly iat: number;
  readonly nbf: number;
  readonly exp: number;
  readonly jti: string;
  readonly certificate: Certificate;
  readonly creatingUser?: CreatingUser;
}

export const CertificateSchema: z.ZodType<Certificate> = certificateSchema;
export const CertificatePayloadSchema: z.ZodType<CertificatePayload> = certificatePayloadSchema;
