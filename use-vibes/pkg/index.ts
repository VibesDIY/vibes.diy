// Clean consumer API - ONLY exports for user vibes
export {
  // Core Firefly-backed database integration
  useFireproof,
  fireproof,
  type FireproofOpts,

  // AI integration
  callAI,
  callAi,
  type CallAI,

  // Viewer identity & capabilities hook
  useViewer,
  type UseViewerResult,

  // Meta-vibes: hand off to the builder to create a new, personalized vibe
  createVibe,
  buildCreateVibeUrl,
  type CreateVibeOptions,

  // Install ID generation
  generateInstallId,

  // Hooks (kept for compatibility)
  useMobile,
} from "@vibes.diy/use-vibes-base";
