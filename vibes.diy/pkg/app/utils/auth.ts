/**
 * Authentication utilities for handling token-based auth
 */
import { toast } from "react-hot-toast";
import {
  CLOUD_SESSION_TOKEN_PUBLIC_KEY,
  CONNECT_API_URL,
  CONNECT_URL,
} from "../config/env.js";
import { verifyFireproofToken, type FireproofTokenPayload } from "use-vibes";

// Re-export the interface from use-vibes for backwards compatibility
export type TokenPayload = FireproofTokenPayload;

/**
 * Initiates the authentication flow by generating a resultId and returning the connect URL.
 * No redirect is performed. The resultId is stored in sessionStorage for later polling.
 * Returns an object with { connectUrl, resultId }
 */
export function initiateAuthFlow(): {
  connectUrl: string;
  resultId: string;
} | null {
  // Don't initiate if already on the callback page
  if (window.location.pathname.includes("/auth/callback")) {
    return null;
  }

  // Generate a random resultId (base58btc-like, 10 chars)
  const BASE58BTC_ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  function randomResultId(length = 10) {
    let res = "z";
    for (let i = 0; i < length; i++) {
      res +=
        BASE58BTC_ALPHABET[
          Math.floor(Math.random() * BASE58BTC_ALPHABET.length)
        ];
    }
    return res;
  }
  const resultId = randomResultId();
  sessionStorage.setItem("auth_result_id", resultId);

  // Compose the connect URL (no redirect, just return)
  const connectUrl = `${CONNECT_URL}?result_id=${resultId}&countdownSecs=0&skipChooser=1&fromApp=vibesdiy`;
  return { connectUrl, resultId };
}

/**
 * Polls the Fireproof Connect API for a token using the resultId.
 * Resolves with the token string when found, or null if timed out.
 * @param {string} resultId
 * @param {number} intervalMs
 * @param {number} timeoutMs
 */
export async function pollForAuthToken(
  resultId: string,
  intervalMs = 1500,
  timeoutMs = 60000,
  mock: {
    fetch: typeof fetch;
    toast: { success: (s: string) => void };
  } = { fetch, toast },
): Promise<string | null> {
  const endpoint = `${CONNECT_API_URL}/token/${resultId}`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await mock.fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resultId, type: "reqTokenByResultId" }),
      });
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      if (data && typeof data.token === "string" && data.token.length > 0) {
        // Store the token in localStorage for future use
        localStorage.setItem("auth_token", data.token);
        toast.success("Logged in successfully!");
        return data.token;
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null; // Timed out
}

/**
 * Verify the token using the enhanced verifier from use-vibes
 * Supports both regular Fireproof tokens and Clerk-generated tokens
 */
export async function verifyToken(
  token: string,
): Promise<{ payload: TokenPayload } | null> {
  try {
    const result = await verifyFireproofToken(
      token,
      CLOUD_SESSION_TOKEN_PUBLIC_KEY,
    );
    if (!result) return null;

    const { payload } = result;

    // Check if token is about to expire and extend it if needed (for regular tokens)
    if (payload.source !== "clerk" && isTokenAboutToExpire(payload)) {
      const extendedToken = await extendToken(token);
      if (extendedToken) {
        // Verify the extended token to get its payload
        const extendedResult = await verifyToken(extendedToken);
        if (extendedResult) {
          return extendedResult;
        }
        console.warn(
          "Extended token verification failed, using original token",
        );
      } else {
        console.warn("Token extension failed, using current token");
      }
    }

    return { payload };
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}

/**
 * Extend an existing token if it's about to expire
 * @param {string} currentToken - The current token to extend
 * @returns {Promise<string | null>} - The new extended token or null if extension failed
 */
export async function extendToken(
  currentToken: string,
  mock = { fetch },
): Promise<string | null> {
  try {
    const endpoint = CONNECT_API_URL;

    const res = await mock.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: currentToken, type: "reqExtendToken" }),
    });

    if (!res.ok) throw new Error("Network error during token extension");

    const data = await res.json();
    if (data && typeof data.token === "string" && data.token.length > 0) {
      // Store the new token in localStorage
      localStorage.setItem("auth_token", data.token);
      return data.token;
    }

    return null;
  } catch (error) {
    console.error("Error extending token:", error);
    return null;
  }
}

/**
 * Check if a token is about to expire (within 5 minutes)
 * @param {TokenPayload} payload - The decoded token payload
 * @returns {boolean} - True if token expires within 5 minutes
 */
function isTokenAboutToExpire(payload: TokenPayload): boolean {
  const expiryInMs = 60 * 60 * 1000; // 1 hour
  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();

  return expirationTime - currentTime <= expiryInMs;
}
