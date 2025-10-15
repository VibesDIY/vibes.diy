import { importJWK, jwtVerify } from "jose";
import { base58btc } from "multiformats/bases/base58";
function decodePublicKeyJWK(encoded) {
  try {
    const decodedBytes = base58btc.decode(encoded);
    const rawText = new TextDecoder().decode(decodedBytes);
    const jwk = JSON.parse(rawText);
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
export async function verifyToken(token, publicKey) {
  try {
    const jwk = decodePublicKeyJWK(publicKey);
    const key = await importJWK(jwk, "ES256");
    const { payload } = await jwtVerify(token, key, {
      issuer: "FP_CLOUD",
      audience: "PUBLIC",
    });
    if (!payload.exp || typeof payload.exp !== "number") {
      console.error("Token missing expiration");
      return null;
    }
    if (payload.exp * 1000 < Date.now()) {
      console.error("Token has expired");
      return null;
    }
    const tokenPayload = payload;
    return { payload: tokenPayload };
  } catch (error) {
    console.error("Error verifying or decoding token:", error);
    return null;
  }
}
export async function extendToken(
  currentToken,
  connectApiUrl,
  fetchImpl = fetch,
) {
  try {
    const res = await fetchImpl(connectApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: currentToken, type: "reqExtendToken" }),
    });
    if (!res.ok) throw new Error("Network error during token extension");
    const data = await res.json();
    if (data && typeof data.token === "string" && data.token.length > 0) {
      return data.token;
    }
    return null;
  } catch (error) {
    console.error("Error extending token:", error);
    return null;
  }
}
export function isTokenAboutToExpire(payload, thresholdMs = 60 * 60 * 1000) {
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();
  return expirationTime - currentTime <= thresholdMs;
}
export function getUserId(payload) {
  return payload.userId || null;
}
export function hasTenantRole(payload, tenantId, role) {
  return payload.tenants.some(
    (tenant) => tenant.id === tenantId && tenant.role === role,
  );
}
export function hasLedgerAccess(payload, ledgerId, right = "read") {
  return payload.ledgers.some(
    (ledger) =>
      ledger.id === ledgerId &&
      (ledger.right === "rw" || ledger.right === right),
  );
}
//# sourceMappingURL=auth.js.map
