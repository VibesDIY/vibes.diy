// Public API for vibe mounting utilities
export { mountVibeCode } from './mountVibeCode.js';
export { mountVibeWithCleanup } from './mountVibeWithCleanup.js';
export type {
  VibesMountReadyDetail,
  VibesMountErrorDetail,
  MountResult,
  MountOutcome,
} from './types.js';
export { isVibesMountReadyEvent, isVibesMountErrorEvent } from './types.js';
