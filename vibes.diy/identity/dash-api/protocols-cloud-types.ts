// Lifted verbatim from @fireproof/core-types-protocols-cloud@0.24.19
// `msg-types.zod.ts` (upstream tag fireproof-storage/fireproof@core@v0.24.19).
// This is the minimal cloud-package closure the owned dashboard types need:
// `Role`, `ReadWrite`, `TenantLedger`, and `FPCloudClaim` (plus the schemas they
// transitively reference — `TenantClaimSchema`, `LedgerClaimSchema`). None of the
// rest of the cloud package (msg-types-data/meta/wal, gateway-control) is pulled.
// Only imports were repointed — the zod import normalized (`zod/v4` → `zod`) and
// `JWTPayloadSchema` sourced from the owned `./protocols-base-jwt.js` instead of
// `@fireproof/core-types-base`. No type/schema shapes changed.
import { z } from "zod";
import { JWTPayloadSchema } from "./protocols-base-jwt.js";

// Role and ReadWrite enums
export const RoleSchema = z.enum(["admin", "owner", "member"]);
export const ReadWriteSchema = z.enum(["read", "write"]);

// Related interface schemas
export const TenantClaimSchema = z
  .object({
    id: z.string(),
    role: RoleSchema,
  })
  .readonly();

export const LedgerClaimSchema = z
  .object({
    id: z.string(),
    role: RoleSchema,
    right: ReadWriteSchema,
  })
  .readonly();

export const TenantLedgerSchema = z
  .object({
    appId: z.string().optional(),
    tenant: z.string(),
    ledger: z.string(),
  })
  .readonly();

// Main FPCloudClaim schema
export const FPCloudClaimSchema = JWTPayloadSchema.extend({
  userId: z.string(),
  email: z.email(),
  nickname: z.string().optional(),
  provider: z.enum(["github", "google"]).optional(),
  created: z.coerce.date(),
  tenants: z.array(TenantClaimSchema),
  ledgers: z.array(LedgerClaimSchema),
  selected: TenantLedgerSchema,
}).readonly();

// Type inference from schemas
export type Role = z.infer<typeof RoleSchema>;
export type ReadWrite = z.infer<typeof ReadWriteSchema>;
export type TenantClaim = z.infer<typeof TenantClaimSchema>;
export type LedgerClaim = z.infer<typeof LedgerClaimSchema>;
export type TenantLedger = z.infer<typeof TenantLedgerSchema>;
export type FPCloudClaim = z.infer<typeof FPCloudClaimSchema>;

// For parsing JWT payload with date transformation
export const FPCloudClaimParseSchema = JWTPayloadSchema.extend({
  userId: z.string(),
  email: z.email(),
  nickname: z.string().optional(),
  provider: z.enum(["github", "google"]).optional(),
  // Transform string to Date if needed (common in JWT parsing)
  created: z.union([z.date(), z.string().transform((str) => new Date(str)), z.number().transform((num) => new Date(num))]),
  tenants: z.array(TenantClaimSchema),
  ledgers: z.array(LedgerClaimSchema),
  selected: TenantLedgerSchema,
}).readonly();
