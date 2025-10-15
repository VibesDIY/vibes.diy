/**
 * Shared authentication utilities for vibes.diy monorepo
 * Used by both frontend and backend packages
 */
import { importJWK, jwtVerify } from "jose";
import { base58btc } from "multiformats/bases/base58";

// Token payload interface - standardized across frontend and backend
export interface TokenPayload {
  email?: string;
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

// JWK interface for public key handling
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
 * @param encoded - Base58btc-encoded JSON string representing a JWK
 * @returns The parsed JWK public key
 */
function decodePublicKeyJWK(encoded: string): JWK {
  try {
    const decodedBytes = base58btc.decode(encoded);
    const rawText = new TextDecoder().decode(decodedBytes);
    const jwk = JSON.parse(rawText) as JWK;
    return jwk;
  } catch (err) {
    console.error("Failed to parse JWK from base58btc string:", err);
    return {
      kty: "EC",
      crv: "P-256",
      x: "",
      y: "",
    };
  }
}

/**
 * Verify a JWT token using the provided public key.
 * This provides proper cryptographic verification of JWT tokens.
 * @param token - The JWT token to verify
 * @param publicKey - The base58btc-encoded JWK public key
 * @returns Object with decoded payload if valid, otherwise null
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

    // Validate expiration
    if (!payload.exp || typeof payload.exp !== "number") {
      console.error("Token missing expiration");
      return null;
    }

    // Check if token is expired
    if (payload.exp * 1000 < Date.now()) {
      console.error("Token has expired");
      return null;
    }

    const tokenPayload = payload as unknown as TokenPayload;
    return { payload: tokenPayload };
  } catch (error) {
    console.error("Error verifying or decoding token:", error);
    return null;
  }
}

/**
 * Extend an existing token if it's about to expire
 * @param currentToken - The current token to extend
 * @param connectApiUrl - The connect API URL for token extension
 * @param fetchImpl - Optional fetch implementation (for testing)
 * @returns The new extended token or null if extension failed
 */
export async function extendToken(
  currentToken: string,
  connectApiUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const res = await fetchImpl(connectApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: currentToken, type: "reqExtendToken" }),
    });

    if (!res.ok) throw new Error("Network error during token extension");

    const data = (await res.json()) as { token?: string };
    if (data && typeof data.token === "string" && data.token.length > 0) {
      return data.token;
    }

    return null;
  } catch (error) {
    console.error("Error extending token:", error);
    return null;
  }
}

/**
 * Check if a token is about to expire (within specified threshold)
 * @param payload - The decoded token payload
 * @param thresholdMs - Time threshold in milliseconds (default 1 hour)
 * @returns True if token expires within threshold
 */
export function isTokenAboutToExpire(
  payload: TokenPayload,
  thresholdMs = 60 * 60 * 1000, // 1 hour default
): boolean {
  const expirationTime = payload.exp * 1000; // Convert to milliseconds
  const currentTime = Date.now();
  return expirationTime - currentTime <= thresholdMs;
}

/**
 * Extract user ID from a verified token payload
 * @param payload - The token payload
 * @returns User ID or null if not present
 */
export function getUserId(payload: TokenPayload): string | null {
  return payload.userId || null;
}

/**
 * Check if user has specific tenant role
 * @param payload - The token payload
 * @param tenantId - The tenant ID to check
 * @param role - The required role
 * @returns True if user has the role in the tenant
 */
export function hasTenantRole(
  payload: TokenPayload,
  tenantId: string,
  role: string,
): boolean {
  return payload.tenants.some(
    (tenant) => tenant.id === tenantId && tenant.role === role,
  );
}

/**
 * Check if user has access to a specific ledger
 * @param payload - The token payload
 * @param ledgerId - The ledger ID to check
 * @param right - The required right (read/write)
 * @returns True if user has access
 */
export function hasLedgerAccess(
  payload: TokenPayload,
  ledgerId: string,
  right: "read" | "write" = "read",
): boolean {
  return payload.ledgers.some(
    (ledger) =>
      ledger.id === ledgerId &&
      (ledger.right === "rw" || ledger.right === right),
  );
}
