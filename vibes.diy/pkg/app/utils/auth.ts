/**
 * Authentication utilities for handling token-based auth
 */
import { importJWK, jwtVerify } from "jose";
import { toast } from "react-hot-toast";
import {
  CLOUD_SESSION_TOKEN_PUBLIC_KEY,
  CONNECT_API_URL,
  CONNECT_URL,
} from "../config/env.js";
import { base58btc } from "multiformats/bases/base58";

// Export the interface
export interface TokenPayload {
  email?: string; // Assuming email might be added or needed later
  userId: string;
  tenants: {
    id: string;
    role: string;
  }[];
  ledgers: {
    id: string;
    role: string;
    right: string;
  }[];
  iat: number;
  iss: string;
  aud: string;
  exp: number;
}

// Base58 alphabet for base58btc
// const BASE58BTC_ALPHABET =
//   "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Define JWK type
interface JWK {
  kty: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  ext?: boolean;
  key_ops?: string[];
}

/**
 * Decode a base58btc-encoded string to bytes
 * @param {string} str - The base58btc-encoded string
 * @returns {Uint8Array} - The decoded bytes
 */
function base58btcDecode(str: string): Uint8Array {
  return base58btc.decode(str);
  // // Remove the 'z' prefix for base58btc if present
  // let input = str;
  // if (input.startsWith("z")) {
  //   input = input.slice(1);
  // }

  // let num = BigInt(0);
  // for (let i = 0; i < input.length; i++) {
  //   const char = input[i];
  //   const value = BASE58BTC_ALPHABET.indexOf(char);
  //   if (value === -1) throw new Error(`Invalid base58 character: ${char}`);
  //   num = num * BigInt(58) + BigInt(value);
  // }

  // // Convert to bytes
  // const bytes = [];
  // while (num > 0) {
  //   bytes.unshift(Number(num % BigInt(256)));
  //   num = num / BigInt(256);
  // }

  // // Account for leading zeros in the input
  // for (let i = 0; i < input.length; i++) {
  //   if (input[i] === "1") {
  //     bytes.unshift(0);
  //   } else {
  //     break;
  //   }
  // }

  // return new Uint8Array(bytes);
}

/**
 * Decode a base58btc-encoded JWK string to a public key JWK
 * @param {string} encodedString - The base58btc-encoded JWK string
 * @returns {JWK} - The decoded JWK public key
 */
function decodePublicKeyJWK(encodedString: string): JWK {
  // Decode the base58btc string
  const decoded = base58btcDecode(encodedString);

  // Try to parse as JSON
  try {
    const rawText = new TextDecoder().decode(decoded);
    return JSON.parse(rawText);
  } catch (error) {
    // If parsing fails, log the error and return a default JWK
    console.error("Failed to parse JWK from base58btc string:", error);

    return {
      kty: "EC",
      crv: "P-256",
      x: "",
      y: "",
    };
  }
}

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
  } = { fetch: window.fetch.bind(window), toast },
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
 * Verify the token using jose library and return payload if valid.
 * This provides proper cryptographic verification of JWT tokens.
 * If the token is about to expire, it will attempt to extend it automatically.
 * Returns an object with the decoded payload and potentially extended token if valid, otherwise null.
 */
export async function verifyToken(
  token: string,
): Promise<{ payload: TokenPayload } | null> {
  try {
    // Base58btc-encoded public key (replace with actual key)
    const encodedPublicKey = CLOUD_SESSION_TOKEN_PUBLIC_KEY;

    // Decode the base58btc-encoded JWK
    const publicKey = decodePublicKeyJWK(encodedPublicKey);

    // Import the JWK
    const key = await importJWK(publicKey, "ES256");

    // Verify the token
    const { payload } = await jwtVerify(token, key, {
      issuer: "FP_CLOUD",
      audience: "PUBLIC",
    });

    // If we got here, verification succeeded
    if (!payload.exp || typeof payload.exp !== "number") {
      console.error("Token missing expiration");
      return null; // Missing expiration
    }

    // Check if token is expired
    if (payload.exp * 1000 < Date.now()) {
      // Convert to milliseconds
      console.error("Token has expired");
      return null; // Token expired
    }

    const tokenPayload = payload as unknown as TokenPayload;

    // Check if token is about to expire and extend it if needed
    if (isTokenAboutToExpire(tokenPayload)) {
      const extendedToken = await extendToken(token);
      if (extendedToken) {
        // Verify the extended token to get its payload
        const extendedResult = await verifyToken(extendedToken);
        if (extendedResult) {
          return extendedResult;
        }
        // If extended token verification failed, fall back to original
        console.warn(
          "Extended token verification failed, using original token",
        );
      } else {
        console.warn("Token extension failed, using current token");
      }
    }

    // Return the payload
    return { payload: tokenPayload };
  } catch (error) {
    console.error("Error verifying or decoding token:", error);
    return null; // Verification failed
  }
}

/**
 * Extend an existing token if it's about to expire
 * @param {string} currentToken - The current token to extend
 * @returns {Promise<string | null>} - The new extended token or null if extension failed
 */
export async function extendToken(
  currentToken: string,
  mock = { fetch: window.fetch.bind(window) },
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
