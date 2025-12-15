/**
 * Simple AuthContext that wraps Clerk's useAuth
 * This provides a consistent interface for components that need auth state
 */
import type { ReactNode } from "react";
import React, { createContext, useCallback, useContext, useState } from "react";
import { useAuth as useClerkAuth } from "@clerk/clerk-react";

// Simplified TokenPayload type for compatibility
export interface TokenPayload {
  userId: string;
  email?: string;
}

export interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userPayload: TokenPayload | null;
  needsLogin: boolean;
  setNeedsLogin: (value: boolean) => void;
  checkAuthStatus: () => Promise<void>;
  processToken: (token: string | null) => Promise<void>;
}

// Create the context with a default value
export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

// Define the props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides authentication state and actions to the application.
 * Uses Clerk under the hood.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { isSignedIn, isLoaded, userId } = useClerkAuth();
  const [needsLogin, setNeedsLoginState] = useState<boolean>(false);

  const isAuthenticated = isLoaded && isSignedIn === true;
  const isLoading = !isLoaded;

  const userPayload: TokenPayload | null = userId ? { userId } : null;

  // These are no-ops since Clerk handles token management
  const checkAuthStatus = useCallback(async () => {
    // Clerk handles this automatically
  }, []);

  const processToken = useCallback(async (_token: string | null) => {
    // Clerk handles this automatically
  }, []);

  // Function to set needsLogin
  const setNeedsLogin = useCallback(
    (value: boolean) => {
      setNeedsLoginState(value);

      // If user is already authenticated, don't set needsLogin to true
      if (value && isAuthenticated) {
        setNeedsLoginState(false);
      }
    },
    [isAuthenticated],
  );

  // Value provided by the context
  const value: AuthContextType = {
    token: null, // Clerk manages tokens internally
    isAuthenticated,
    isLoading,
    userPayload,
    needsLogin,
    setNeedsLogin,
    checkAuthStatus,
    processToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to consume the AuthContext.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
