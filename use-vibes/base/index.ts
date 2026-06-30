import { callAI } from "call-ai";
import { type } from "arktype";

export * from "./contexts/VibeContext.js";

export { fireproof, type FireproofOpts } from "./fireproof-node.js";

// `useFireproof` is the Firefly-backed drop-in from the vibe runtime — the same
// implementation the iframe import map aliases `use-vibes` → `@vibes.diy/vibe-runtime`
// resolves to, so the published SDK and the sandbox agree on one DB surface.
export { useFireproof } from "@vibes.diy/vibe-runtime";

export const vibesEnvSchema = type({
  FPCLOUD_URL: "string",
  DASHBOARD_URL: "string",
  // CLERK_PUBLISHABLE_KEY: "string",
  // CALLAI_API_KEY: "string",
  // CALLAI_CHAT_URL: "string",
  // CALLAI_IMG_URL: "string",
  VIBES_DIY_STYLES_URL: "string",
});

export type VibesEnv = typeof vibesEnvSchema.infer;

export const vibeEnv = type("Record<string, string>");
export type VibeEnv = typeof vibeEnv.infer;

const slugPattern = /^(?!.*\/|.*--|.*\.\.)[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$/;

export const vibeBindings = type({
  appSlug: slugPattern,
  ownerHandle: slugPattern,
  fsId: slugPattern,
  "groupId?": slugPattern,
});
export type VibeBindings = typeof vibeBindings.infer;

export const vibesDiyMountParams = type({
  bindings: vibeBindings,
  env: vibeEnv.and(vibesEnvSchema),
});
export type VibesDiyMountParams = typeof vibesDiyMountParams.infer;

// Re-export specific functions and types from call-ai

export { callAI, callAI as callAi };

// Re-export all types under a namespace
export type * as CallAI from "call-ai";

// ImgVibes and related components live in @vibes.diy/base

// Export hooks
export { useThemeDetection } from "./hooks/useThemeDetection.js";
export { useMobile } from "./hooks/useMobile.js";

export type { ImgVibesClasses } from "@vibes.diy/use-vibes-types";

// Export utility functions
export { base64ToFile } from "./utils/base64.js";
export { constructVibesDatabaseName } from "./utils/databaseName.js";

// Export types for testing and advanced usage
export type { ImageDocument, PartialImageDocument, UseImgVibesOptions, UseImgVibesResult } from "@vibes.diy/use-vibes-types";

// Export useViewer hook and types — re-exported from @vibes.diy/vibe-runtime
// so the sandbox import-map alias `use-vibes` → `@vibes.diy/vibe-runtime`
// also surfaces the hook (see vibes.diy/api/svc/intern/grouped-vibe-import-map.ts).
export { useViewer, type UseViewerResult } from "@vibes.diy/vibe-runtime";

// createVibe — hand off to the builder to generate a new vibe ("meta-vibes").
// Re-exported from @vibes.diy/vibe-runtime so the sandbox import-map alias
// `use-vibes` → `@vibes.diy/vibe-runtime` surfaces it too, exactly like useViewer.
export {
  createVibe,
  buildCreateVibeUrl,
  VIBES_DIY_BUILDER_URL,
  CREATE_VIBE_SAFE_URL_LENGTH,
  type CreateVibeOptions,
} from "@vibes.diy/vibe-runtime";

// App-specific components moved to vibes.diy/pkg/app - no longer exported

// Export app slug utilities
export {
  getAppSlug,
  getInstanceId,
  getFullAppIdentifier,
  isDevelopmentEnvironment,
  isProductionEnvironment,
  generateRandomInstanceId,
  generateFreshDataUrl,
  generateRemixUrl,
  generateInstallId,
} from "./utils/appSlug.js";

// Export VibeContext for inline rendering with proper ledger naming (needed by useFireproof)
export { VibeContextProvider, useVibeContext, VibeMetadataValidationError } from "./contexts/VibeContext.js";

// export type { VibeMetadata } from './contexts/VibeContext.js';

// Mounting utilities moved to vibes.diy/pkg/app - no longer exported
