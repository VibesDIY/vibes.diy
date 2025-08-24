// Export auth components and hooks
export { ClerkAuthProvider } from './components/ClerkAuthProvider.js';
export { VibesClerkAuth } from './components/VibesClerkAuth.js';
export { useClerkAuth, type ClerkAuthState } from './hooks/useClerkAuth.js';

// Export token generation utilities for Fireproof integration
export {
  generateFireproofToken,
  verifyFireproofToken,
  storeFireproofToken,
  getStoredFireproofToken,
  type FireproofTokenPayload,
} from './utils/tokenGeneration.js';
