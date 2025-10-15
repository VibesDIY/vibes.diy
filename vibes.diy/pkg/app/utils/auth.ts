/**
 * Authentication utilities for handling token-based auth
 */
import {
  verifyToken as baseVerifyToken,
  extendToken as baseExtendToken,
  isTokenAboutToExpire,
  type TokenPayload,
  type TokenResponse,
} from "@vibes.diy/utils";
import { toast } from "react-hot-toast";
import { systemFetch } from "./systemFetch.js";
import { VibesDiyEnv } from "../config/env.js";

// Re-export the TokenPayload type from utils
export type { TokenPayload };

/**
 * Initiates the authentication flow by generating a resultId and returning the connect URL.
 * No redirect is performed. The resultId is stored in sessionStorage for later polling.
 * Returns an object with { connectUrl, resultId }
 */

function callPathname(pathnameFn?: () => string) {
  return pathnameFn ? pathnameFn() : globalThis.window.location.pathname;
}

export function initiateAuthFlow({
  pathnameFn,
}: { pathnameFn?: () => string } = {}): {
  connectUrl: string;
  resultId: string;
} | null {
  // Don't initiate if already on the callback page
  if (callPathname(pathnameFn).includes("/auth/callback")) {
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
  const connectUrl = `${VibesDiyEnv.CONNECT_URL()}?result_id=${resultId}&countdownSecs=0&skipChooser=1&fromApp=vibesdiy`;
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
  } = { fetch: systemFetch, toast },
): Promise<string | null> {
  const endpoint = `${VibesDiyEnv.CONNECT_API_URL()}/token/${resultId}`;
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
      const data = (await res.json()) as TokenResponse;
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
 * Verify the token using jose library and return payload if valid.
 * This provides proper cryptographic verification of JWT tokens.
 * If the token is about to expire, it will attempt to extend it automatically.
 * Returns an object with the decoded payload and potentially extended token if valid, otherwise null.
 */
export async function verifyToken(
  token: string,
): Promise<{ payload: TokenPayload } | null> {
  // Get the public key from environment
  const publicKey = VibesDiyEnv.CLOUD_SESSION_TOKEN_PUBLIC_KEY();

  // Use the base verifyToken from utils package
  const result = await baseVerifyToken(token, publicKey);
  if (!result) return null;

  // Check if token is about to expire and extend it if needed
  if (isTokenAboutToExpire(result.payload)) {
    const extendedToken = await extendToken(token);
    if (extendedToken) {
      // Verify the extended token but don't trigger another extension
      const extendedResult = await baseVerifyToken(extendedToken, publicKey);
      if (extendedResult) {
        return extendedResult;
      }
      // If extended token verification failed, fall back to original
      console.warn("Extended token verification failed, using original token");
    } else {
      console.warn("Token extension failed, using current token");
    }
  }

  return result;
}

/**
 * Extend an existing token if it's about to expire
 * @param {string} currentToken - The current token to extend
 * @returns {Promise<string | null>} - The new extended token or null if extension failed
 */
export async function extendToken(
  currentToken: string,
  mock = { fetch: systemFetch },
): Promise<string | null> {
  const connectApiUrl = VibesDiyEnv.CONNECT_API_URL();

  // Use the base extendToken from utils package
  const result = await baseExtendToken(currentToken, connectApiUrl, mock.fetch);

  if (result) {
    // Store the new token in localStorage (vibes.diy specific behavior)
    localStorage.setItem("auth_token", result);
  }

  return result;
}

// isTokenAboutToExpire is imported from @vibes.diy/utils
