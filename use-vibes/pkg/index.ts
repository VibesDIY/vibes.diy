// Clean consumer API - ONLY exports for user vibes
export {
  // Core Fireproof integration
  useFireproof,
  fireproof,
  ImgFile,
  toCloud,
  type Fireproof,

  // Types
  type UseVibesOptions,
  type UseVibesResult,
  type VibeDocument,

  // Install ID generation
  generateInstallId,

  // Hooks (kept for compatibility)
  useMobile,
} from "@vibes.diy/use-vibes-base";
