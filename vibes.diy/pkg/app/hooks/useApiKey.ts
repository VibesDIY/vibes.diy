import { useAuth } from "@clerk/clerk-react";

/**
 * Simplified hook for API key management
 * Returns a dummy key that the backend proxy can identify and handle
 */
export function useApiKey() {
  const { getToken } = useAuth();

  const ensureApiKey = async () => {
    const token = await getToken();
    if (!token) {
      throw new Error("User is not authenticated.");
    }
    return { key: token, hash: "clerk" };
  };

  return {
    apiKey: null, // The key is now fetched asynchronously
    apiKeyObject: null,
    error: null,
    refreshKey: ensureApiKey,
    ensureApiKey,
    saveApiKey: () => {
      /* no-op */
    },
    clearApiKey: () => {
      /* no-op */
    },
  };
}
