// Browser-safe surface of @vibes.diy/identity.
//
// Everything re-exported here is safe to LINK in a browser bundle: pure types
// (erased at build), the zod schemas, the `core-runtime` context helpers, and
// the Clerk dashboard client — all of which are already browser-linked by
// today's call sites. Node-only crypto (keybag, device-id signing, server CA)
// lives behind the "./node.js" subpath so it never reaches browser bundles.
//
// This is the single seam: source code imports identity concerns from here (or
// "@vibes.diy/identity/node"), never from `@fireproof/*` directly. The package
// is still fireproof-backed internally — swapping those internals is a later,
// self-contained step that does not touch any call site.

export { ensureRuntimeContext, type RuntimeContext } from "./runtime-context.js";
export { ClerkClaimSchema, ClerkEmailTemplateClaimSchema, type ClerkClaim } from "./clerk-claim.js";

// --- Runtime context / logging helpers (core-runtime is browser-safe) ---
export { ensureSuperThis, ensureLogger, runtimeFn, hashObjectSync, sts } from "@fireproof/core-runtime";

// --- Auth wire-types (type-only; erased at build) ---
// Owned in-repo (Task 4 / Bucket B):
export type {
  DashAuthType,
  ReqCertFromCsr,
  ResCertFromCsr,
  VerifiedClaimsResult,
  VerifiedAuthResult,
  WithAuth,
  FPApiParameters,
  FPApiToken,
} from "./types/wire.js";

// Still upstream-sourced (deferred): VerifiedResult pulls the User type graph;
// SuperThis/DocTypes are Bucket E (runtime context); the JWK TYPES + FPDeviceIDSession /
// DeviceIdKeyBagItem / DeviceIdResult / DeviceIdCAIf stay upstream to preserve
// type-identity — only the JWK schema VALUES are owned (below).
export type { VerifiedResult } from "@fireproof/core-types-protocols-dashboard";
export type {
  SuperThis,
  FPDeviceIDSession,
  DocTypes,
  JWKPrivate,
  JWKPublic,
  DeviceIdKeyBagItem,
  DeviceIdResult,
} from "@fireproof/core-types-base";
export type { DeviceIdCAIf } from "@fireproof/core-types-device-id";

// --- Schemas (zod; browser-safe runtime values; owned in-repo, Task 4) ---
export { JWKPrivateSchema, JWKPublicSchema } from "./types/wire.js";

// --- Clerk dashboard client (already browser-linked via VibeContext today) ---
export { ClerkApiToken, clerkDashApi, DashboardApiImpl } from "@fireproof/core-protocols-dashboard";
