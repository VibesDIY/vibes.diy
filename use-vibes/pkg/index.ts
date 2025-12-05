// Clean consumer API - ONLY exports for user vibes
export {
  // Core Fireproof integration
  useFireproof,
  fireproof,
  ImgFile,
  toCloud,
  type Fireproof,

  // AI integration
  callAI,
  callAi,
  type CallAI,

  // Consumer components
  ImgGen,
  type ImgGenProps,

  // Vibes generation hook
  useVibes,
  type UseVibesOptions,
  type UseVibesResult,
  type VibeDocument,

  // Install ID generation
  generateInstallId,

  // Clerk integration
  VibeClerkIntegration,
  useDashboardApi,

  // Hooks (kept for compatibility)
  useMobile,
} from '@vibes.diy/use-vibes-base';
