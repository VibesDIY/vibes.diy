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
  nickname?: string;
  provider?: 'github' | 'google' | 'clerk';
  created?: string;
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
 * Exchange a Clerk JWT for a proper Fireproof token via dashboard API
 * This creates a real Fireproof token with correct user ID format
 */
export async function generateFireproofToken(clerkJwt: string, publicKey: string): Promise<string> {
  try {
    console.log('Exchanging Clerk JWT for Fireproof token...');

    // Use Fireproof's default connect API URL
    const connectApiUrl = 'https://connect.fireproof.direct/api';

    const response = await fetch(connectApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'reqCloudSessionToken', // ✅ Correct endpoint
        auth: {
          token: clerkJwt,
          type: 'clerk',
        },
      }),
    });

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = await response.text();
      }
      console.error('Dashboard API error details:', errorDetails);
      throw new Error(
        `Dashboard API error: ${response.status} ${response.statusText}: ${JSON.stringify(errorDetails)}`
      );
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error('No token returned from dashboard API');
    }

    console.log('Successfully exchanged Clerk JWT for Fireproof token');
    return data.token;
  } catch (error) {
    console.error('Error exchanging Clerk JWT for Fireproof token:', error);
    throw new Error('Failed to exchange Clerk JWT for Fireproof token');
  }
}

/**
 * Verify a Fireproof token using the public key
 */
export async function verifyFireproofToken(
  token: string,
  publicKey: string
): Promise<{ payload: FireproofTokenPayload } | null> {
  try {
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
