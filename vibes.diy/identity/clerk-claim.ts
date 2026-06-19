import { z } from "zod";

/**
 * Vibes-owned copy of fireproof's Clerk JWT claim schema, lifted verbatim from
 * `@fireproof/core-types-base`'s `fp-clerk-claim.zod` **including the in-repo
 * patch** (`patches/@fireproof__core-types-base@0.24.19.patch`): the `.catch()`
 * defaults on `first` / `image_url` / `last` / `name`. Real Clerk JWTs omit
 * those fields, and without the catch the strict schema rejects them.
 *
 * This is the phase-1 **parity artifact**: vibes code validates Clerk claims
 * through this owned schema instead of the patched upstream one. The upstream
 * patch is still required (fireproof's own `tokenApi.verify` imports its copy)
 * and is removed only once the verifier itself is extracted.
 */
export const ClerkEmailTemplateClaimSchema = z.object({
  nick: z.string().optional(),
  email: z.string(),
  email_verified: z.boolean(),
  external_id: z.string().nullable().optional(),
  first: z.string().catch(""),
  image_url: z.string().catch(""),
  last: z.string().catch(""),
  name: z.string().nullable().catch(null),
  public_meta: z.unknown(),
});

export const ClerkClaimSchema = z.object({
  azp: z.string().optional(),
  exp: z.number().int().optional(),
  iat: z.number().int().optional(),
  iss: z.string().optional(),
  jti: z.string().optional(),
  nbf: z.number().int().optional(),
  params: ClerkEmailTemplateClaimSchema,
  role: z.string(),
  sub: z.string(),
  userId: z.string(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  app_metadata: z.unknown().optional(),
});

export type ClerkClaim = z.infer<typeof ClerkClaimSchema>;
