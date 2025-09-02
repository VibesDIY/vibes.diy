// Re-export specific items from use-fireproof
import { fireproof, useFireproof as originalUseFireproof, ImgFile } from 'use-fireproof';
export { fireproof, ImgFile };

// Re-export all types under a namespace
export type * as Fireproof from 'use-fireproof';

// Custom useFireproof hook with vibes-specific logging
// Preserve the exact function type (including generics) of the original hook
export const useFireproof: typeof originalUseFireproof = (
  ...args: Parameters<typeof originalUseFireproof>
) => {
  console.log('Using vibes-customized useFireproof');
  return originalUseFireproof(...args);
};

// Re-export specific functions and types from call-ai
import { callAI } from 'call-ai';
export { callAI, callAI as callAi };

// Re-export all types under a namespace
export type * as CallAI from 'call-ai';

// Export ImgGen component - the primary export
export { ImgGen } from './components/ImgGen.js';
export type { ImgGenProps } from './components/ImgGen.js';

// Export all components for testing and advanced usage
export { ControlsBar } from './components/ControlsBar.js';
export { PromptBar } from './components/PromptBar.js';

// Export hooks
export { useImageGen, hashInput } from './hooks/image-gen/index.js';

// Export style utilities
export { type ImgGenClasses, defaultClasses } from './utils/style-utils.js';

// Export utility functions
export { base64ToFile } from './utils/base64.js';

// Export ImgGen sub-components
export { ImageOverlay } from './components/ImgGenUtils/overlays/ImageOverlay.js';
export { ImgGenDisplay } from './components/ImgGenUtils/ImgGenDisplay.js';
export { ImgGenModal } from './components/ImgGenUtils/ImgGenModal.js';
export { ImgGenDisplayPlaceholder } from './components/ImgGenUtils/ImgGenDisplayPlaceholder.js';

// Export internal utilities and constants
export { MODULE_STATE } from './hooks/image-gen/utils.js';
export { addNewVersion } from './hooks/image-gen/utils.js';

// Export types for testing and advanced usage
export type { ImageDocument } from './hooks/image-gen/types.js';
export type { ImgGenDisplayProps } from './components/ImgGenUtils/types.js';
export type { ImgGenModalProps } from './components/ImgGenUtils/ImgGenModal.js';
export {
  type UseImageGenOptions,
  type UseImageGenResult,
  type PartialImageDocument,
} from './hooks/image-gen/types.js';
