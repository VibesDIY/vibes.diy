// Owned device-id payload + cert-subject schemas (Task 6.3 — drop the last
// `@fireproof/core-types-base` VALUE imports from the identity package).
//
// Lifted verbatim from `core-types-base`'s `fp-device-id-payload.zod` @ 0.24.19
// (upstream tag fireproof-storage/fireproof@v0.24.19), with two adjustments:
//   1. imports repointed in-repo (`JWKPublicSchema` → `./wire.js`,
//      `ClerkClaimSchema` → `../clerk-claim.js` — the OWNED lenient copy so a CSR
//      that carries a `creatingUser` clerk claim keeps the `.catch()` parity the
//      deleted patch provided);
//   2. the externally-consumed schemas are annotated with their upstream named
//      type (`z.ZodType<…>`) so tsc emits a portable, nameable declaration
//      instead of inlining zod-internal symbols (TS2883) — same pattern as
//      `cert-payload.ts`. The runtime schema is byte-identical; the annotation is
//      type-only.
//
// `JWTPayloadSchema` / `CreatingUserSchema` are internal building blocks (nothing
// imports them directly), so they stay un-exported: their inferred Zod types
// reference zod-internal symbols by a pnpm-hashed path that can't be named
// portably in an emitted `.d.ts`, and only the schemas below cross the package's
// module boundary.
import { z } from "zod";
import type { Subject, Extensions, FPDeviceIDCSRPayload, FPDeviceIDSession } from "@fireproof/core-types-base";
import { JWKPublicSchema } from "./wire.js";
import { ClerkClaimSchema } from "../clerk-claim.js";

const JWTPayloadSchema = z.object({
  azp: z.string().optional(),
  iss: z.string().optional(),
  sub: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().int().optional(),
  nbf: z.number().int().optional(),
  iat: z.number().int().optional(),
  jti: z.string().optional(),
});

const CreatingUserSchema = z.object({
  type: z.literal("clerk"),
  claims: ClerkClaimSchema,
});

export const SubjectSchema: z.ZodType<Subject> = z.object({
  commonName: z.string(),
  countryName: z.string().length(2).optional(),
  stateOrProvinceName: z.string().optional(),
  locality: z.string().optional(),
  organization: z.string().optional(),
  organizationalUnitName: z.string().optional(),
  emailAddress: z.string().email().optional(),
  serialNumber: z.string().optional(),
  streetAddress: z.string().optional(),
  postalCode: z.string().optional(),
  businessCategory: z.string().optional(),
  jurisdictionCountryName: z.string().length(2).optional(),
  jurisdictionStateOrProvinceName: z.string().optional(),
  jurisdictionLocalityName: z.string().optional(),
}) as z.ZodType<Subject>;

export const ExtensionsSchema: z.ZodType<Extensions> = z.object({
  subjectAltName: z.array(z.string()).optional(),
  keyUsage: z
    .array(
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
    )
    .optional(),
  extendedKeyUsage: z
    .array(
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
    )
    .optional(),
  basicConstraints: z
    .object({
      cA: z.boolean().optional(),
      pathLenConstraint: z.number().int().min(0).optional(),
    })
    .optional(),
  authorityKeyIdentifier: z.string().optional(),
  subjectKeyIdentifier: z.string().optional(),
  certificatePolicies: z
    .array(
      z.object({
        policyIdentifier: z.string(),
        policyQualifiers: z.array(z.string()).optional(),
      })
    )
    .optional(),
  crlDistributionPoints: z.array(z.string().url()).optional(),
  authorityInfoAccess: z
    .object({
      ocsp: z.array(z.string().url()).optional(),
      caIssuers: z.array(z.string().url()).optional(),
    })
    .optional(),
  nameConstraints: z
    .object({
      permitted: z.array(z.string()).optional(),
      excluded: z.array(z.string()).optional(),
    })
    .optional(),
}) as z.ZodType<Extensions>;

export const FPDeviceIDCSRPayloadSchema: z.ZodType<FPDeviceIDCSRPayload> = JWTPayloadSchema.extend({
  creatingUser: CreatingUserSchema.optional(),
  csr: z
    .object({
      subject: SubjectSchema,
      publicKey: JWKPublicSchema,
      extensions: ExtensionsSchema.optional(),
    })
    .strict()
    .readonly(),
})
  .strict()
  .readonly() as z.ZodType<FPDeviceIDCSRPayload>;

export const FPDeviceIDSessionSchema: z.ZodType<FPDeviceIDSession> = JWTPayloadSchema.extend({
  deviceId: z.string(),
  seq: z.number().int().min(0),
})
  .strict()
  .readonly() as z.ZodType<FPDeviceIDSession>;
