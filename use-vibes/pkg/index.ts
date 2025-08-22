// Re-export everything from use-fireproof for drop-in compatibility
export * from 'use-fireproof';

// Import original useFireproof for customization
import { useFireproof as originalUseFireproof } from 'use-fireproof';

// Custom useFireproof hook with vibes-specific logging
// Preserve the exact function type (including generics) of the original hook
export const useFireproof: typeof originalUseFireproof = (
  ...args: Parameters<typeof originalUseFireproof>
) => {
  console.log('Using vibes-customized useFireproof');
  return originalUseFireproof(...args);
};

// Re-export specific functions and types from call-ai
import { imageGen, callAi, type ImageGenOptions, type ImageResponse } from 'call-ai';
export { imageGen, callAi, type ImageGenOptions, type ImageResponse };

// Export ImgGen component
export { default as ImgGen } from './components/ImgGen.js';
export type { ImgGenProps } from './components/ImgGen.js';

export { ControlsBar } from './components/ControlsBar.js';

export { useImageGen, hashInput } from './hooks/image-gen/index.js';

// Export style utilities
export { type ImgGenClasses, defaultClasses } from './utils/style-utils.js';

// Export utility functions
export { base64ToFile } from './utils/base64.js';

export { PromptBar } from './components/PromptBar.js';

export { ImageOverlay } from './components/ImgGenUtils/overlays/ImageOverlay.js';

export { MODULE_STATE } from './hooks/image-gen/utils.js';

export { type ImageDocument } from './hooks/image-gen/types.js';

export { addNewVersion } from './hooks/image-gen/utils.js';

export { ImgGenDisplay } from './components/ImgGenUtils/ImgGenDisplay.js';
export { ImgGenModal } from './components/ImgGenUtils/ImgGenModal.jsx';

export { ImgGenDisplayPlaceholder } from './components/ImgGenUtils/ImgGenDisplayPlaceholder.js';

export {
  type UseImageGenOptions,
  type UseImageGenResult,
  type PartialImageDocument,
} from './hooks/image-gen/types.js';
