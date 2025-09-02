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
 * Decode and inspect JWT header and payload for debugging
 */
function inspectJWT(jwt: string): { header: any; payload: any } {
  const [headerB64, payloadB64] = jwt.split('.');
  
  const header = JSON.parse(atob(headerB64));
  const payload = JSON.parse(atob(payloadB64));
  
  return { header, payload };
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
  console.group('📡 === FIREPROOF TOKEN EXCHANGE ===');
  try {
    console.log('🔑 Input JWT length:', clerkJwt.length);
    console.log('🔑 Public key:', publicKey);

    // Inspect JWT structure for debugging
    const { header, payload } = inspectJWT(clerkJwt);
    console.log('🔍 JWT Header:', JSON.stringify(header, null, 2));
    console.log('🔑 Key ID (kid):', header.kid);
    console.log('📝 Algorithm:', header.alg);
    console.log('🏢 Issuer (iss):', payload.iss);
    console.log('👤 Subject (sub):', payload.sub);
    console.log('⏰ Issued at:', new Date(payload.iat * 1000).toISOString());
    console.log('⏰ Expires at:', new Date(payload.exp * 1000).toISOString());

    // Validate JWT structure
    if (!header.kid) {
      console.warn('⚠️ JWT missing kid (Key ID) in header');
    }
    if (!header.alg) {
      console.warn('⚠️ JWT missing alg (Algorithm) in header');
    }

    // Validate JWT before sending to API
    if (!payload.iss || !payload.sub || !payload.exp) {
      throw new Error('Invalid JWT: missing required fields (iss, sub, exp)');
    }

    if (payload.exp * 1000 < Date.now()) {
      throw new Error('JWT has expired');
    }

    console.log('✅ JWT validation passed, proceeding with token exchange...');

    // Use Fireproof's default connect API URL
    const connectApiUrl = 'https://connect.fireproof.direct/api';
    console.log('🌐 API URL:', connectApiUrl);

    const requestBody = {
      type: 'reqCloudSessionToken', // ✅ Correct endpoint
      auth: {
        token: clerkJwt,
        type: 'clerk',
      },
    };
    console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

    console.log('🌐 Making fetch request...');
    const response = await fetch(connectApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }).catch((fetchError) => {
      console.error('🚫 Fetch failed with error:', fetchError);
      console.error('🚫 Error name:', fetchError.name);
      console.error('🚫 Error message:', fetchError.message);
      console.error('🚫 Error cause:', fetchError.cause);
      throw fetchError;
    });

    console.log('📥 Response status:', response.status, response.statusText);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      let errorDetails;
      try {
        errorDetails = await response.json();
        console.log('❌ Error response JSON:', errorDetails);
      } catch {
        errorDetails = await response.text();
        console.log('❌ Error response text:', errorDetails);
      }
      console.error('❌ Dashboard API error details:', errorDetails);
      throw new Error(
        `Dashboard API error: ${response.status} ${response.statusText}: ${JSON.stringify(errorDetails)}`
      );
    }

    const data = await response.json();
    console.log('📥 Success response:', data);

    if (!data.token) {
      console.error('❌ No token field in response!');
      throw new Error('No token returned from dashboard API');
    }

    console.log('✅ Token exchange successful, token length:', data.token.length);
    return data.token;
  } catch (error) {
    console.error('❌ Error exchanging Clerk JWT for Fireproof token:', error);
    throw error; // Re-throw the original error with full context
  } finally {
    console.groupEnd();
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
