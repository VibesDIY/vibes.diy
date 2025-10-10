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
  VibesSwitch,
  VibesButton,
  type VibeControlProps,
  mountVibeControl,
  mountVibeControlToBody,
  autoMountVibeControl,
  type MountVibeControlOptions,
  type MountVibeControlResult,
  // HiddenMenuWrapper component and utilities
  HiddenMenuWrapper,
  VibesPanel,
  type VibesPanelProps,
  mountHiddenMenuWrapper,
  mountHiddenMenuWrapperToBody,
  autoMountHiddenMenuWrapper,
  type HiddenMenuWrapperProps,
  type MountHiddenMenuWrapperOptions,
  type MountHiddenMenuWrapperResult,
  // AuthWall component and utilities
  AuthWall,
  type AuthWallProps,
  mountAuthWall,
  type MountAuthWallOptions,
  type MountAuthWallResult,
  vibeControlTheme,
  createVibeControlStyles,
  defaultVibeControlClasses,
  type VibeControlClasses,
  hiddenMenuTheme,

  // Type namespaces
  type Fireproof,
  type CallAI,
} from '@vibes.diy/use-vibes-base';
