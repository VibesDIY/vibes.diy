# Popup Authentication Flow

This document describes how the authentication system works in the Vibes DIY application.

## Architecture Components

- **AuthContext** (`contexts/AuthContext.tsx:18-172`): Central auth state management with React Context
- **useAuth** (`contexts/AuthContext.tsx:166-172`): Hook to consume auth context
- **useAuthPopup** (`hooks/useAuthPopup.ts:6-49`): Hook managing popup-based login flow
- **NeedsLoginModal** (`components/NeedsLoginModal.tsx:11-95`): Modal that triggers when login is required

## Auth State Management

The AuthContext maintains several key pieces of state:
- `token`: JWT token string
- `isAuthenticated`: Boolean derived from token and payload validity
- `isLoading`: Loading state during auth operations
- `userPayload`: Decoded token payload containing user info (userId, tenants, ledgers)
- `needsLogin`: Boolean flag triggering login prompts

## Login Flow

### Initiation (`useAuthPopup.ts:11-42`)
1. User clicks login → `trackAuthClick()` for analytics
2. `initiateAuthFlow()` generates a random `resultId` and stores it in sessionStorage
3. Opens popup window to Fireproof Connect service at `${CONNECT_URL}?result_id=${resultId}`
4. Starts polling for auth token using `pollForAuthToken()`

### Token Acquisition (`utils/auth.ts:156-190`)
1. Polls `${CONNECT_API_URL}/token/${resultId}` every 1.5 seconds for up to 60 seconds
2. When token is received, stores it in localStorage
3. Returns token to the popup flow

### Token Processing (`contexts/AuthContext.tsx:50-68`)
1. `processToken()` calls `verifyToken()` to cryptographically verify the JWT
2. Uses JOSE library with ES256 algorithm and Fireproof's public key
3. If valid, updates auth state with token and decoded payload
4. If invalid/expired, clears localStorage and resets state

## Token Verification & Management

### Verification Process (`utils/auth.ts:198-256`)
- Decodes base58btc-encoded public key from environment
- Uses JOSE library to verify JWT signature against Fireproof's public key
- Validates issuer ("FP_CLOUD") and audience ("PUBLIC")
- Checks token expiration

### Auto-Extension (`utils/auth.ts:263-305`)
- If token expires within 1 hour, automatically attempts extension
- Calls Connect API with current token to get refreshed token
- Seamlessly updates localStorage with new token

## Auth State Persistence

### Initialization (`contexts/AuthContext.tsx:84-87`)
- On app startup, `checkAuthStatus()` reads token from localStorage
- Verifies stored token and sets auth state accordingly

### Message Listener (`contexts/AuthContext.tsx:90-121`)
- Listens for `authSuccess` messages from popup window
- Processes received tokens and updates auth state
- Only accepts messages from same origin for security

## Login Requirements & UX

### Triggering Login (`contexts/AuthContext.tsx:126-138`)
- Components call `setNeedsLogin(true, reason)` when auth is required
- Prevents setting needsLogin if user is already authenticated
- Automatically resets when user becomes authenticated

### Login Modal (`components/NeedsLoginModal.tsx:16-34`)
- Shows when `needsLogin` becomes true
- Presents "Log in for Credits" messaging
- Initiates popup login flow when clicked

## Integration Points

The auth system integrates throughout the app:
- **Root component** (`root.tsx:108`) wraps app with `<AuthProvider>`
- **Credit system**: Authentication required for additional usage credits
- **Session management**: Auth state affects chat sessions and data persistence
- **API calls**: Token used for authenticated requests to backend services

## Security Features

- Cryptographic JWT verification using ES256 algorithm
- Same-origin message validation for popup communication
- Automatic token expiration handling
- Secure token storage in localStorage
- Base58btc encoding for public key distribution

This creates a seamless, popup-based OAuth flow that maintains persistent login state while providing clear UX for when authentication is required.