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

// --- Browser-safe device-id login (device-id browser-login spec) ---
// Mints + claim-extracts device-id tokens in the browser, fed an in-memory
// keybag item (Seam 1 + Seam 3). Browser-safe because it never touches the
// node-only keybag (getKeyBag/fs) — only the isomorphic DeviceIdKey/DeviceIdSignMsg.
export { createDeviceIdGetTokenFromItem, deviceIdClaimsFromToken, type DeviceIdItem } from "./device-id/browser-token.js";
