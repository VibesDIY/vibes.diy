import { useAuth, useUser } from '@clerk/clerk-react';

export interface ClerkAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: any | null;
  userId: string | null;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

/**
 * Bridge hook between Clerk authentication and vibes patterns
 * Provides a clean API that matches existing auth expectations
 */
export function useClerkAuth(): ClerkAuthState {
  const { isSignedIn, isLoaded, getToken, signOut } = useAuth();
  const { user } = useUser();

  return {
    // Match existing AuthContext patterns
    isAuthenticated: isSignedIn ?? false,
    isLoading: !isLoaded,
    user: user ?? null,
    userId: user?.id ?? null,

    // Expose Clerk's token getter for future token conversion
    getToken: async () => {
      try {
        return await getToken();
      } catch (error) {
        console.error('Error getting Clerk token:', error);
        return null;
      }
    },

    // Clerk sign out
    signOut: async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    },
  };
}
