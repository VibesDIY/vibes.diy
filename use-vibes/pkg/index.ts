// Re-export clean public API from core package
export {
  // Primary component
  ImgGen,
  type ImgGenProps,

  // Fireproof integration
  fireproof,
  ImgFile,

  // AI integration
  callAI,
  callAi,

  // Auth components (Phase 2)
  ClerkAuthProvider,
  VibesClerkAuth,
  useClerkAuth,

  // Fireproof token utilities (Phase 3)
  generateFireproofToken,
  verifyFireproofToken,
  storeFireproofToken,
  getStoredFireproofToken,
  type FireproofTokenPayload,

  // Type namespaces
  type Fireproof,
  type CallAI,
} from '@vibes.diy/use-vibes-base';

// Custom useFireproof hook with vibes-specific logging
// Import the original hook and customize it at the package level
import { useFireproof as originalUseFireproof } from '@vibes.diy/use-vibes-base';

// Preserve the exact function type (including generics) of the original hook
export const useFireproof: typeof originalUseFireproof = (
  ...args: Parameters<typeof originalUseFireproof>
) => {
  console.log('Using vibes-customized useFireproof');
  return originalUseFireproof(...args);
};
