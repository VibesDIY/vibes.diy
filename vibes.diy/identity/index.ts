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

// --- Runtime context / logging helpers (in-repo cement-glue lift, T4) ---
export { ensureSuperThis, ensureLogger, runtimeFn } from "./runtime/superthis.js";
// hashObjectSync (T2), the sts JWK/JWT crypto (T3), and the SuperThis context
// (T4) are all lifted in-repo; only the test cross-checks still import
// @fireproof/core-runtime, removed when the dep is dropped in T5.
export * as sts from "./sts/index.js";
export { hashObjectSync } from "./runtime/hashing.js";

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

// VerifiedResult pulls the User type graph and stays upstream-sourced (the
// `core-types-protocols-dashboard` types are out of scope for #2937). Everything
// else — the SuperThis context, the JWK / cert / session types, the keybag item
// types, and the device-id CA interface — is now OWNED in-repo (#2937), so the
// device-id/keybag crypto and its base types no longer touch `@fireproof/core-*`.
export type { VerifiedResult } from "@fireproof/core-types-protocols-dashboard";
export type { SuperThis, DocTypes } from "./types/sthis.js";
export type { JWKPrivate, JWKPublic } from "./types/wire.js";
export type { FPDeviceIDSession } from "./types/device-id-payload.js";
export type { DeviceIdKeyBagItem, DeviceIdResult } from "./types/keybag-item.js";
export type { DeviceIdCAIf } from "./types/device-id-types.js";

// --- Schemas (zod; browser-safe runtime values; owned in-repo, Task 4) ---
export { JWKPrivateSchema, JWKPublicSchema } from "./types/wire.js";

// --- Clerk dashboard client (already browser-linked via VibeContext today) ---
// `ClerkApiToken` is the OWNED lift (dash-api/clerk-token.ts): its `decode()`
// parses through the owned lenient `ClerkClaimSchema`, so real Clerk JWTs that
// omit `first`/`image_url`/`last`/`name` still decode now that the upstream
// `core-types-base` patch is gone. The upstream `ClerkApiToken` would parse with
// the now-strict upstream schema and reject those JWTs — breaking the browser
// `getTokenClaims()` path (api/impl/index.ts). The dedicated `clerk-token.js`
// module has no device-id-crypto deps, so this stays out of the browser bundle's
// device-id graph. `clerkDashApi`/`DashboardApiImpl` (the dashboard HTTP client,
// not claim decoders) are now OWNED in-repo too (dash-api/dash-client.ts,
// Task 6.2), so the browser `.` surface no longer imports any `@fireproof/*`
// VALUE except the `core-runtime` context helpers (Bucket E).
export { ClerkApiToken } from "./dash-api/clerk-token.js";
export { clerkDashApi, DashboardApiImpl } from "./dash-api/dash-client.js";
