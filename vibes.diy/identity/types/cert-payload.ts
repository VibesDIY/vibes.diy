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
import { SubjectSchema, ExtensionsSchema } from "./device-id-payload.js";
import type { CertificatePayload } from "@fireproof/core-types-base";
import { JWKPublicSchema } from "./wire.js";
import { ClerkClaimSchema } from "../clerk-claim.js";

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
