import { useAuth } from "@clerk/clerk-react";
import React, { useEffect, useState } from "react";

interface ExchangeResponse {
  token: string;
  expiresIn: number;
}

export default function TokenProvider() {
  const { getToken, isSignedIn } = useAuth();
  const [status, setStatus] = useState<"connecting" | "active" | "error">(
    "connecting",
  );
  const [parentOrigin, setParentOrigin] = useState<string>("");

  useEffect(() => {
    // Verify we were opened by a parent window
    if (!window.opener) {
      // Allow testing in isolation if needed, but show warning
      console.warn("No parent window found (window.opener is null)");
      // For now we don't error out immediately to allow debugging, but in prod this might be desired
      // setStatus('error');
      // return;
    }

    // Get parent origin for security
    const origin = window.opener?.location?.origin || "";
    setParentOrigin(origin);

    // Whitelist of allowed origins for security
    // In development we might want to be more permissive or check env vars
    // For now, we'll allow localhost and vibes.diy domains
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173", // Vite default
      "https://vibes.diy",
      "https://strudel.cc", // Example external consumer
      "https://strudel.fp",
    ];

    // Also allow any vibesdiy.work subdomain (for apps)
    const isVibesDiyWork = origin.endsWith(".vibesdiy.work");
    const isAllowed = allowedOrigins.includes(origin) || isVibesDiyWork;

    if (origin && !isAllowed) {
      console.error("Unauthorized parent origin:", origin);
      setStatus("error");
      return;
    }

    if (!isSignedIn) {
      // If not signed in, we can't provide tokens
      // We could try to sign in, but usually the user should be signed in on the main site first
      console.log("User not signed in");
      setStatus("error");
      return;
    }

    const exchangeToken = async () => {
      try {
        // Get fresh Clerk token
        const clerkToken = await getToken();
        if (!clerkToken) {
          throw new Error("No Clerk token available");
        }

        // Exchange for vibes JWT
        const response = await fetch("/api/auth/exchange-token", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clerkToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Token exchange failed: ${response.status}`);
        }

        const { token, expiresIn } =
          (await response.json()) as ExchangeResponse;

        // Send token to parent via postMessage
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "vibes-token",
              token,
              expiresIn,
              timestamp: Date.now(),
            },
            origin,
          );
        }

        setStatus("active");
      } catch (error) {
        console.error("Token exchange error:", error);
        setStatus("error");
      }
    };

    // Initial token exchange
    exchangeToken();

    // Refresh every 30 seconds (before Clerk token expires)
    const interval = setInterval(exchangeToken, 30000);

    // Cleanup
    return () => clearInterval(interval);
  }, [getToken, isSignedIn]);

  // Auto-close if parent closes
  useEffect(() => {
    const checkParent = setInterval(() => {
      if (window.opener && window.opener.closed) {
        window.close();
      }
    }, 1000);

    return () => clearInterval(checkParent);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Vibes DIY Authentication</h1>

        {status === "connecting" && (
          <p className="text-gray-600">Connecting...</p>
        )}

        {status === "active" && (
          <>
            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2 animate-pulse" />
            <p className="text-green-600 font-medium">Connected</p>
            {parentOrigin && (
              <p className="text-sm text-gray-500 mt-2">
                Providing tokens to {parentOrigin}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-4">
              Keep this window open while using the app
            </p>
          </>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <p className="text-red-600">
              Authentication error. Please close and retry.
            </p>
            {!isSignedIn && (
              <p className="text-sm text-gray-500">
                You need to be signed in to Vibes DIY first.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
