// Lifted verbatim from @fireproof/core-types-base@0.24.19 `jwt-payload.zod.ts`
// (upstream tag fireproof-storage/fireproof@core@v0.24.19). This is the minimal
// base-package closure needed by the owned cloud claim schemas
// (`protocols-cloud-types.ts`): `FPCloudClaimSchema` extends `JWTPayloadSchema`.
// Only the zod import was normalized (`zod/v4` → `zod`) to match the identity
// package's zod-v4 install, exactly as the owned `clerk-claim.ts` did when it was
// lifted from the same base package. No type/schema shapes changed.
import { z } from "zod";

// JWT Payload Schema (standard claims)
export const JWTPayloadSchema = z.object({
  azp: z.string().optional(), // authorized party
  iss: z.string().optional(), // issuer
  sub: z.string().optional(), // subject
  aud: z.union([z.string(), z.array(z.string())]).optional(), // audience
  exp: z.number().int().optional(), // expiration time
  nbf: z.number().int().optional(), // not before
  iat: z.number().int().optional(), // issued at
  jti: z.string().optional(), // JWT ID
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

export const OpenJWTPayloadSchema = z.intersection(
  JWTPayloadSchema,
  z.record(z.string(), z.any()) // Custom claims
);

export type OpenJWTPayload = z.infer<typeof OpenJWTPayloadSchema>;
