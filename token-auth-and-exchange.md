# Token Auth & Exchange Flow Analysis

This document describes the current observed authentication flow and the specific failure point encountered when integrating the `vibes.diy` development environment with the Fireproof Connect backend.

## The Goal
Authenticate a user on the `vibes.diy` local development environment using a **Clerk Development Instance** (`sincere-cheetah-30...`) and successfully exchange this token for a Fireproof Cloud token (`fp-cloud-jwt`) via the production Fireproof backend (`https://connect.fireproof.direct/api`).

## The Flow

1.  **Client Authentication (Success)**
    *   The `vibes.diy` app uses `@clerk/clerk-react` to sign the user in.
    *   **Result:** A valid JWT is obtained.
    *   **Issuer (`iss`):** `https://sincere-cheetah-30.clerk.accounts.dev`
    *   **Key ID (`kid`):** `ins_35qNS5Jwyc7z4aJRBIS7o205yzb`
    *   **Algorithm:** `RS256`
    *   **Audience (`aud`):** `undefined` (No audience claim present).

2.  **Token Verification / Exchange Request (Failure)**
    *   The client calls `DashboardApi.getCloudSessionToken({})`.
    *   **Payload:** `{ auth: { type: "clerk", token: "..." } }`
    *   **Endpoint:** `PUT https://connect.fireproof.direct/api`

3.  **Backend Verification (Error)**
    *   The backend receives the request and attempts to verify the token.
    *   **Backend Configuration:** The backend is configured with `CLERK_PUB_JWT_URL` containing three issuers, including the development one:
        *   `https://clerk.fireproof.direct`
        *   `https://clerk.vibes.diy`
        *   `https://sincere-cheetah-30.clerk.accounts.dev`
    *   **Response:** HTTP 500
    *   **Error Message:**
        ```json
        {
          "type": "error",
          "message": "No well-known JWKS URL could verify the token:\n[
  {
    "type": "error",
    "error": {
      "reason": "token-invalid-signature"
    },
    "url": "https://clerk.fireproof.direct/.well-known/jwks.json"
  },
  {
    "type": "error",
    "error": {
      "reason": "token-invalid-signature"
    },
    "url": "https://clerk.vibes.diy/.well-known/jwks.json"
  },
  {
    "type": "error",
    "error": {
      "reason": "token-invalid-signature"
    },
    "url": "https://sincere-cheetah-30.clerk.accounts.dev/.well-known/jwks.json"
  }
]"
        }
        ```

## Diagnosis Findings

*   **✅ Issuer Match:** The client sends a token from `sincere-cheetah-30`. The backend *is* attempting to verify against the corresponding JWKS URL.
*   **✅ Key ID Match:** The client token has `kid: 'ins_35qNS5Jwyc7z4aJRBIS7o205yzb'`. The public JWKS at `https://sincere-cheetah-30.clerk.accounts.dev/.well-known/jwks.json` currently contains this exact key.
*   **❌ Signature Verification Failure:** Despite the correct issuer and key ID, the backend reports `token-invalid-signature`.

## Potential Root Causes for Review

1.  **Audience (`aud`) Validation:**
    *   The client token has **no `aud` claim**.
    *   Does the backend's `@hono/clerk-auth` middleware (or underlying `verifyToken` function) enforce a default audience check? If so, the lack of an audience would cause verification to fail even if the signature is valid.

2.  **Stale JWKS Cache:**
    *   Could the backend be caching an older version of the JWKS for `sincere-cheetah-30` that does not yet contain the key `ins_35qNS5Jwyc7z4aJRBIS7o205yzb`?
    *   *Note: This is less likely if this is a stable dev instance, but possible if keys were recently rotated.*

3.  **Crypto/Environment Mismatch:**
    *   Is the backend environment (e.g., Cloudflare Workers) correctly handling the RS256 signature verification for this specific key?

## Request for Engineering Team

Please verify if the Fireproof backend enforces an **Audience (`aud`) claim** on Clerk tokens. If so, what audience value is expected? We may need to configure our Clerk development instance to include this audience in its issued tokens.
