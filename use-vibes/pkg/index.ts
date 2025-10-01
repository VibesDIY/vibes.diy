// Re-export clean public API from core package
export {
  // Primary component
  ImgGen,
  type ImgGenProps,

  // Fireproof integration
  useFireproof,
  fireproof,
  ImgFile,
  toCloud,

  // AI integration
  callAI,
  callAi,

  // Vibes generation hook
  useVibes,
  type UseVibesOptions,
  type UseVibesResult,
  type VibeDocument,

  // Type namespaces
  type Fireproof,
  type CallAI,
} from '@vibes.diy/use-vibes-base';
