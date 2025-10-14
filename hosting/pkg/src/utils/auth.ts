/**
 * Authentication utilities for handling token-based auth
 */
import { importJWK, jwtVerify } from "jose";
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
 * Parse a JWK provided as base58btc-encoded JSON text.
 * Logs debug info at each step.
 * @param {string} encoded - Base58btc-encoded JSON string representing a JWK
 * @returns {JWK} - The parsed JWK public key
 */
function decodePublicKeyJWK(encoded: string): JWK {
  try {
    const decodedBytes = base58btc.decode(encoded);

    const rawText = new TextDecoder().decode(decodedBytes);

    const jwk = JSON.parse(rawText) as JWK;
    return jwk;
  } catch (err) {
    console.error("Failed to decode base58btc JWK:", err);
    return {
      kty: "EC",
      crv: "P-256",
      x: "",
      y: "",
    };
  }
}

/**
 * Verify the token using jose library and return payload if valid.
 * This provides proper cryptographic verification of JWT tokens.
 * Returns an object with the decoded payload if valid, otherwise null.
 * @param {string} token - The JWT token to verify
 * @param {string} publicKey - The JWK JSON string
 */
export async function verifyToken(
  token: string,
  publicKey: string,
): Promise<{ payload: TokenPayload } | null> {
  try {
    // Parse the JWK JSON
    const jwk = decodePublicKeyJWK(publicKey);

    // Import the JWK with explicit ES256 algorithm
    const key = await importJWK(jwk, "ES256");

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
    return { payload: tokenPayload };
  } catch (error) {
    console.error("Error verifying or decoding token:", error);
    return null; // Verification failed
  }
}
