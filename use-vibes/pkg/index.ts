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

  // VibeControl component and utilities
  VibeControl,
  VibesIconPill,
  HiddenMenuWrapper,
  VibesButton,
  type VibeControlProps,
  mountVibeControl,
  mountVibeControlToBody,
  autoMountVibeControl,
  type MountVibeControlOptions,
  type MountVibeControlResult,
  vibeControlTheme,
  createVibeControlStyles,
  defaultVibeControlClasses,
  type VibeControlClasses,

  // Type namespaces
  type Fireproof,
  type CallAI,
} from '@vibes.diy/use-vibes-base';
