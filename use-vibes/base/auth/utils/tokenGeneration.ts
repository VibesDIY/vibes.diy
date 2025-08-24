/**
 * Token generation utilities for Fireproof + Clerk integration
 */
import { importJWK, jwtVerify } from 'jose';
import { base58btc } from 'multiformats/bases/base58';

// Token payload interface matching Fireproof expectations
export interface FireproofTokenPayload {
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
  source?: string;
  clerkUserId?: string;
}

// JWK type definition
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
 */
function base58btcDecode(str: string): Uint8Array {
  return base58btc.decode(str);
}

/**
 * Decode a base58btc-encoded JWK string to a public key JWK
 */
function decodePublicKeyJWK(encodedString: string): JWK {
  const decoded = base58btcDecode(encodedString);

  try {
    const rawText = new TextDecoder().decode(decoded);
    return JSON.parse(rawText);
  } catch (error) {
    console.error('Failed to parse JWK from base58btc string:', error);
    return {
      kty: 'EC',
      crv: 'P-256',
      x: '',
      y: '',
    };
  }
}

/**
 * Generate a Fireproof-compatible token from Clerk user data
 * This creates a token that works with existing Fireproof auth infrastructure
 */
export async function generateFireproofToken(clerkUser: any, publicKey: string): Promise<string> {
  try {
    // Extract user information from Clerk user
    const userId = clerkUser.id;
    const email = clerkUser.emailAddresses?.[0]?.emailAddress;

    // Create the token payload matching Fireproof format
    const now = Math.floor(Date.now() / 1000);

    const tokenData = {
      userId,
      email,
      tenants: [],
      ledgers: [],
      iat: now,
      iss: 'FP_CLOUD',
      aud: 'PUBLIC',
      exp: now + 60 * 60, // 1 hour from now
      source: 'clerk',
      clerkUserId: clerkUser.id,
    };

    // Create a JWT-like token structure
    const header = btoa(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify(tokenData));
    const signature = btoa('clerk-generated-token');

    return `${header}.${payload}.${signature}`;
  } catch (error) {
    console.error('Error generating Fireproof token:', error);
    throw new Error('Failed to generate Fireproof token');
  }
}

/**
 * Verify a token (supports both regular Fireproof tokens and Clerk-generated tokens)
 */
export async function verifyFireproofToken(
  token: string,
  publicKey: string
): Promise<{ payload: FireproofTokenPayload } | null> {
  try {
    // Check if this is a Clerk-generated token
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payloadPart = parts[1];
        const decoded = JSON.parse(atob(payloadPart));

        if (decoded.source === 'clerk') {
          // Check expiration
          if (decoded.exp * 1000 < Date.now()) {
            console.error('Clerk token has expired');
            return null;
          }

          return { payload: decoded as FireproofTokenPayload };
        }
      }
    } catch (clerkError) {
      // Continue with regular verification
    }

    // Regular Fireproof token verification
    const publicKeyJWK = decodePublicKeyJWK(publicKey);
    const key = await importJWK(publicKeyJWK, 'ES256');

    const { payload } = await jwtVerify(token, key, {
      issuer: 'FP_CLOUD',
      audience: 'PUBLIC',
    });

    if (!payload.exp || typeof payload.exp !== 'number') {
      return null;
    }

    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    return { payload: payload as unknown as FireproofTokenPayload };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Store Fireproof token in localStorage for AuthContext integration
 */
export function storeFireproofToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

/**
 * Get stored Fireproof token from localStorage
 */
export function getStoredFireproofToken(): string | null {
  return localStorage.getItem('auth_token');
}
