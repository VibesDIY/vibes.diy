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

  // React components
  VibeControl,
  VibesSwitch,
  VibesButton,
  type VibeControlProps,
  HiddenMenuWrapper,
  type HiddenMenuWrapperProps,
  VibesPanel,
  type VibesPanelProps,
  AuthWall,
  type AuthWallProps,

  // Main mount function - unified API for non-React environments
  mountVibesApp,
  mountVibesAppToBody,
  type MountVibesAppOptions,
  type MountVibesAppResult,
  vibeControlTheme,
  createVibeControlStyles,
  defaultVibeControlClasses,
  type VibeControlClasses,
  hiddenMenuTheme,

  // Install tracking for catalog pages
  initVibesInstalls,
  constructSubdomain,
  generateInstallId,

  // Mounting utilities for inline vibe rendering
  mountVibeCode,
  mountVibeWithCleanup,
  isVibesMountReadyEvent,
  isVibesMountErrorEvent,
  type VibesMountReadyDetail,
  type VibesMountErrorDetail,

  // Type namespaces
  type Fireproof,
  type CallAI,
} from '@vibes.diy/use-vibes-base';
