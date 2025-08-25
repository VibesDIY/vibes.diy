// Remove jwt-decode import and related code
// import { jwtDecode } from 'jwt-decode';
import type { ReactNode } from "react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
// Import verifyToken and TokenPayload from auth utils
import { type TokenPayload, verifyToken } from "../utils/auth.js";

// Remove the DecodedToken interface if it exists
// interface DecodedToken { ... }

// Update AuthContextType to hold the full payload
export interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userPayload: TokenPayload | null; // Changed from userEmail
  needsLogin: boolean;
  setNeedsLogin: (value: boolean, reason: string) => void;
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
 * Handles initial token loading and listens for messages from the auth popup.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userPayload, setUserPayload] = useState<TokenPayload | null>(null); // Changed state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [needsLogin, setNeedsLoginState] = useState<boolean>(false);

  // Updated function to process token using verifyToken
  const processToken = useCallback(async (newToken: string | null) => {
    console.log(
      "🔄 Processing token:",
      !!newToken ? "token present" : "no token",
    );
    if (newToken) {
      console.log("🔍 Token length:", newToken.length);
      console.log("🧪 Verifying token...");
      const payload = await verifyToken(newToken);
      if (payload) {
        // Valid token and payload
        console.log("✅ Token verification successful!");
        console.log("📋 User payload:", payload.payload);
        setToken(newToken);
        setUserPayload(payload.payload); // Store the full payload
        console.log("✅ Auth state updated - user is authenticated");
      } else {
        // Token is invalid or expired
        console.log("❌ Token verification failed - removing from storage");
        localStorage.removeItem("auth_token");
        setToken(null);
        setUserPayload(null);
        console.log("❌ Auth state cleared - user is not authenticated");
      }
    } else {
      // No token provided
      console.log("⚠️ No token provided - clearing auth state");
      setToken(null);
      setUserPayload(null);
      console.log("❌ Auth state cleared - user is not authenticated");
    }
  }, []); // verifyToken is stable, no dependency needed unless it changes

  // Updated checkAuthStatus to be async
  const checkAuthStatus = useCallback(async () => {
    console.group("🔍 === AUTH STATUS CHECK ===");
    console.log("⏱️ Starting auth status check at:", new Date().toISOString());
    setIsLoading(true);
    try {
      const storedToken = localStorage.getItem("auth_token");
      console.log("🔍 Token in localStorage?", !!storedToken);
      if (storedToken) {
        console.log("🔍 Token length:", storedToken.length);
        console.log(
          "🔍 Token preview (first 50 chars):",
          storedToken.substring(0, 50) + "...",
        );
      }
      console.log("🔄 Processing token...");
      await processToken(storedToken);
    } catch (error) {
      console.error("❌ Error reading auth token from storage:", error);
      await processToken(null); // Ensure state is cleared on error
    } finally {
      setIsLoading(false);
      console.log("✅ Auth status check completed");
      console.groupEnd();
    }
  }, [processToken]);

  // Initial check on component mount
  useEffect(() => {
    void checkAuthStatus(); // Call async function
  }, [checkAuthStatus]);

  // Updated listener for messages from the auth popup
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Make async
      // Only handle auth messages from same origin (popup auth flow)
      // Silently ignore iframe messages from vibesbox.dev subdomains
      if (event.origin !== window.location.origin) {
        return;
      }
      if (
        event.data?.type === "authSuccess" &&
        typeof event.data.token === "string"
      ) {
        const receivedToken = event.data.token;
        setIsLoading(true); // Set loading while processing token
        try {
          localStorage.setItem("auth_token", receivedToken);
          await processToken(receivedToken); // Use async processToken
        } catch (error) {
          console.error("Error processing token from popup message:", error);
          await processToken(null); // Clear state on error
        } finally {
          setIsLoading(false);
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [processToken]);

  const isAuthenticated = !!token && !!userPayload; // Check both token and payload

  // Function to set needsLogin with a reason
  const setNeedsLogin = useCallback(
    (value: boolean, reason: string) => {
      console.log(`Setting needsLogin to ${value} due to: ${reason}`);
      setNeedsLoginState(value);

      // If user is already authenticated, don't set needsLogin to true
      if (value && isAuthenticated) {
        console.log("User is already authenticated, not setting needsLogin");
        setNeedsLoginState(false);
      }
    },
    [isAuthenticated],
  );

  // Reset needsLogin when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && needsLogin) {
      console.log("User authenticated, resetting needsLogin");
      setNeedsLoginState(false);
    }
  }, [isAuthenticated, needsLogin]);

  // Value provided by the context
  const value: AuthContextType = {
    token,
    isAuthenticated,
    isLoading,
    userPayload, // Provide userPayload
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
