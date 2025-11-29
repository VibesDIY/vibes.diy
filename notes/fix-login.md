# 3rd-Party App Authentication via JWT Token Exchange

## Problem Statement

3rd-party applications (like strudel.fp) need to make authenticated streaming AI requests to vibes.diy's backend, but:

1. **Clerk tokens expire every 30 seconds** - too short for seamless UX
2. **No popup window mechanism exists** - can't use Clerk's refresh flow directly
3. **Backend now requires Clerk auth** - old Fireproof token support was removed
4. **Can't expose Clerk tokens** - security risk to share them with 3rd party apps

## Solution: Popup-Based JWT Token Exchange

Use a persistent popup window that maintains a Clerk session and continuously exchanges Clerk tokens for vibes.diy signed JWTs.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ 3rd Party App (e.g., strudel.fp)                           │
│                                                              │
│  1. Opens popup: window.open('/auth/token-provider')       │
│  2. Receives tokens via postMessage                         │
│  3. Uses token in callAI({ headers: { 'X-Vibes-Token' }})  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ postMessage every 30s
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Popup Window: vibes.diy/auth/token-provider                │
│                                                              │
│  1. Clerk authentication (maintains session)                │
│  2. Every 30s:                                              │
│     a. Get fresh Clerk token: getToken()                   │
│     b. Exchange for vibes JWT: POST /api/auth/exchange     │
│     c. postMessage token to opener                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ POST with Clerk token
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: /api/auth/exchange-token                          │
│                                                              │
│  1. Validate Clerk token                                    │
│  2. Extract userId, email                                   │
│  3. Sign new JWT with CLERK_SECRET_KEY                     │
│  4. Return: { token: 'eyJ...', expiresIn: 60 }             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Later: API request with X-Vibes-Token
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend Middleware: X-Vibes-Token Validator                │
│                                                              │
│  1. Check for X-Vibes-Token header                          │
│  2. Verify JWT signature                                    │
│  3. Check expiry                                            │
│  4. Extract user context                                    │
│  5. Set c.set('user', { userId, email })                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Components

### 1. Popup Window Route: `/auth/token-provider`

**Location**: `vibes.diy/pkg/app/routes/auth.token-provider.tsx`

**Purpose**: Minimal React app that maintains Clerk session and provides tokens to parent window

**Key Features**:
- Separate from main app (can be minimal bundle)
- Simple UI: "Connected to [parent origin]" with status indicator
- Auto-closes if parent window closes
- Security: Only postMessage to whitelisted origins

**Implementation**:

```typescript
import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

export default function TokenProvider() {
  const { getToken, isSignedIn } = useAuth();
  const [status, setStatus] = useState<'connecting' | 'active' | 'error'>('connecting');
  const [parentOrigin, setParentOrigin] = useState<string>('');

  useEffect(() => {
    // Verify we were opened by a parent window
    if (!window.opener) {
      setStatus('error');
      return;
    }

    // Get parent origin for security
    const origin = window.opener.location.origin;
    setParentOrigin(origin);

    // Whitelist of allowed origins for security
    const allowedOrigins = [
      'http://localhost:3000',
      'https://strudel.cc',
      // Add other trusted 3rd party apps
    ];

    if (!allowedOrigins.includes(origin)) {
      console.error('Unauthorized parent origin:', origin);
      setStatus('error');
      return;
    }

    if (!isSignedIn) {
      setStatus('error');
      return;
    }

    const exchangeToken = async () => {
      try {
        // Get fresh Clerk token
        const clerkToken = await getToken();
        if (!clerkToken) {
          throw new Error('No Clerk token available');
        }

        // Exchange for vibes JWT
        const response = await fetch('/api/auth/exchange-token', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${clerkToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Token exchange failed: ${response.status}`);
        }

        const { token, expiresIn } = await response.json();

        // Send token to parent via postMessage
        window.opener.postMessage(
          {
            type: 'vibes-token',
            token,
            expiresIn,
            timestamp: Date.now(),
          },
          origin
        );

        setStatus('active');
      } catch (error) {
        console.error('Token exchange error:', error);
        setStatus('error');
      }
    };

    // Initial token exchange
    exchangeToken();

    // Refresh every 30 seconds (before Clerk token expires)
    const interval = setInterval(exchangeToken, 30000);

    // Cleanup
    return () => clearInterval(interval);
  }, [getToken, isSignedIn]);

  // Auto-close if parent closes
  useEffect(() => {
    const checkParent = setInterval(() => {
      if (!window.opener || window.opener.closed) {
        window.close();
      }
    }, 1000);

    return () => clearInterval(checkParent);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Vibes DIY Authentication</h1>

        {status === 'connecting' && (
          <p className="text-gray-600">Connecting...</p>
        )}

        {status === 'active' && (
          <>
            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2 animate-pulse" />
            <p className="text-green-600 font-medium">Connected</p>
            <p className="text-sm text-gray-500 mt-2">
              Providing tokens to {parentOrigin}
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Keep this window open while using the app
            </p>
          </>
        )}

        {status === 'error' && (
          <p className="text-red-600">Authentication error. Please close and retry.</p>
        )}
      </div>
    </div>
  );
}
```

---

### 2. Backend Endpoint: `/api/auth/exchange-token`

**Location**: `hosting/pkg/src/endpoints/authExchangeToken.ts` or `hosting/base/endpoints/auth-exchange-token.ts`

**Purpose**: Exchange Clerk token for signed vibes JWT

**Implementation**:

```typescript
import { OpenAPIRoute } from "chanfana";
import { Context } from "hono";
import { SignJWT } from "jose";
import { z } from "zod";

const ExchangeTokenResponse = z.object({
  token: z.string(),
  expiresIn: z.number(),
});

export class AuthExchangeToken extends OpenAPIRoute {
  schema = {
    tags: ["Auth"],
    summary: "Exchange Clerk token for vibes JWT",
    responses: {
      "200": {
        description: "Returns signed JWT for API access",
        content: {
          "application/json": {
            schema: ExchangeTokenResponse,
          },
        },
      },
    },
  };

  async handle(c: Context<{ Variables: Variables; Bindings: Env }>) {
    // User is already authenticated via Clerk middleware
    const user = c.get("user");

    if (!user || !user.userId) {
      return c.json(
        { error: "Authentication required" },
        401
      );
    }

    try {
      // Create signed JWT with 60 second expiry
      const secret = new TextEncoder().encode(c.env.CLERK_SECRET_KEY);
      const expiresIn = 60; // seconds

      const token = await new SignJWT({
        userId: user.userId,
        email: user.email || null,
        sessionId: user.sessionId,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(`${expiresIn}s`)
        .setIssuer("vibes.diy")
        .setAudience("vibes.diy-api")
        .sign(secret);

      return c.json({
        token,
        expiresIn,
      });
    } catch (error) {
      console.error("Error generating JWT:", error);
      return c.json(
        { error: "Failed to generate token" },
        500
      );
    }
  }
}
```

**Register in `hosting/pkg/src/index.ts`**:
```typescript
import { AuthExchangeToken } from "./endpoints/authExchangeToken.js";

// Add to routes (requires Clerk middleware)
openapi.post("/api/auth/exchange-token", AuthExchangeToken);
```

---

### 3. Backend Middleware: X-Vibes-Token Validation

**Location**: `hosting/pkg/src/middleware/vibesTokenAuth.ts`

**Purpose**: Validate vibes JWT from X-Vibes-Token header as alternative to Clerk auth

**Implementation**:

```typescript
import { jwtVerify } from "jose";
import { Context } from "hono";

interface VibesTokenPayload {
  userId: string;
  email?: string | null;
  sessionId?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

export async function vibesTokenMiddleware() {
  return async (c: Context<{ Bindings: Env; Variables: Variables }>, next: () => Promise<void>) => {
    // If Clerk already authenticated the user, skip
    const existingUser = c.get("user");
    if (existingUser?.userId) {
      return next();
    }

    // Check for X-Vibes-Token header
    const vibesToken = c.req.header("X-Vibes-Token");
    if (!vibesToken) {
      return next(); // No vibes token, continue (may require auth later)
    }

    try {
      // Verify JWT signature and claims
      const secret = new TextEncoder().encode(c.env.CLERK_SECRET_KEY);
      const { payload } = await jwtVerify<VibesTokenPayload>(vibesToken, secret, {
        issuer: "vibes.diy",
        audience: "vibes.diy-api",
      });

      // Set user context from JWT claims
      c.set("user", {
        userId: payload.userId,
        email: payload.email || undefined,
        sessionId: payload.sessionId,
      });

      console.log("✅ Authenticated via X-Vibes-Token:", payload.userId);
    } catch (error) {
      console.error("❌ Invalid X-Vibes-Token:", error);
      // Don't block request - let endpoint handle missing auth
    }

    return next();
  };
}
```

**Register in `hosting/pkg/src/index.ts`**:
```typescript
import { vibesTokenMiddleware } from "./middleware/vibesTokenAuth.js";

// Add AFTER Clerk middleware, BEFORE routes
openapi.use("/api/*", vibesTokenMiddleware());
```

---

### 4. 3rd Party Integration (strudel.fp example)

**Client-side code for strudel.fp**:

```javascript
// Open persistent token provider popup
let tokenPopup = null;
let currentToken = null;

function initVibesAuth() {
  // Open popup (centered, small window)
  const width = 400;
  const height = 500;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;

  tokenPopup = window.open(
    'https://vibes.diy/auth/token-provider',
    'vibes-auth',
    `width=${width},height=${height},left=${left},top=${top}`
  );

  // Listen for tokens from popup
  window.addEventListener('message', (event) => {
    // Verify origin
    if (event.origin !== 'https://vibes.diy') return;

    if (event.data.type === 'vibes-token') {
      currentToken = event.data.token;
      console.log('Received vibes token, expires in', event.data.expiresIn, 'seconds');

      // Update window.CALLAI_API_KEY for call-ai library
      window.CALLAI_API_KEY = currentToken;
    }
  });
}

// Use in callAI calls
import { callAI } from 'call-ai';

const response = await callAI(messages, {
  apiKey: currentToken, // or window.CALLAI_API_KEY
  endpoint: 'https://vibes-diy-api.com/api/v1/chat/completions',
  // The call-ai library will add: headers: { 'Authorization': `Bearer ${token}` }
});
```

**Note**: The backend will need to check BOTH:
- `Authorization: Bearer ${token}` header (as X-Vibes-Token)
- Existing Clerk authentication

---

## JWT Token Format

### Claims Structure

```json
{
  "userId": "user_123abc",
  "email": "user@example.com",
  "sessionId": "sess_456def",
  "iss": "vibes.diy",
  "aud": "vibes.diy-api",
  "iat": 1732896000,
  "exp": 1732896060
}
```

### Security Properties

- **Signing Algorithm**: HS256
- **Secret**: CLERK_SECRET_KEY (already in env)
- **TTL**: 60 seconds (allows 30s refresh interval with buffer)
- **Stateless**: No database lookup needed for validation
- **Issuer**: vibes.diy (prevents token reuse elsewhere)
- **Audience**: vibes.diy-api (prevents usage on other services)

---

## PostMessage Protocol

### Message Format (Popup → Parent)

```typescript
interface VibesTokenMessage {
  type: 'vibes-token';
  token: string;        // Signed JWT
  expiresIn: number;    // Seconds until expiry
  timestamp: number;    // When token was issued (Date.now())
}
```

### Security Considerations

1. **Origin Validation**: Popup MUST validate parent origin against whitelist
2. **Opaque Tokens**: Parent only receives signed JWT, not Clerk token
3. **Short TTL**: 60s expiry limits exposure window
4. **HTTPS Only**: Enforce HTTPS in production

---

## Backend Middleware Integration

### Current Flow (Clerk only)

```typescript
// hosting/pkg/src/index.ts
openapi.use("/api/*", clerkMiddleware());
openapi.use("/api/*", async (c, next) => {
  const auth = getAuth(c);
  if (auth?.userId) {
    c.set("user", { userId: auth.userId, ... });
  }
  await next();
});
```

### New Flow (Clerk + Vibes JWT)

```typescript
// hosting/pkg/src/index.ts
import { vibesTokenMiddleware } from "./middleware/vibesTokenAuth.js";

// 1. Try Clerk authentication first
openapi.use("/api/*", clerkMiddleware());
openapi.use("/api/*", async (c, next) => {
  const auth = getAuth(c);
  if (auth?.userId) {
    c.set("user", { userId: auth.userId, sessionId: auth.sessionId });
  }
  await next();
});

// 2. If no Clerk user, try X-Vibes-Token
openapi.use("/api/*", vibesTokenMiddleware());

// 3. Routes can now access c.get("user") from either auth method
```

**Note**: The middleware checks `Authorization: Bearer ${token}` header (which call-ai library sends automatically), treating it as X-Vibes-Token when it's not a Clerk token.

---

## Alternative Header Strategy

If we want to explicitly use X-Vibes-Token header instead of Authorization:

**Call-AI Integration**:
```typescript
// In 3rd party app
await callAI(messages, {
  apiKey: currentToken,
  headers: {
    'X-Vibes-Token': currentToken,
  },
  endpoint: 'https://vibes-diy-api.com/api/v1/chat/completions',
});
```

**Backend Middleware**:
```typescript
// Check X-Vibes-Token header specifically
const vibesToken = c.req.header("X-Vibes-Token") ||
                   c.req.header("Authorization")?.replace("Bearer ", "");
```

---

## Deployment Considerations

### 1. Separate Bundle Option

The `/auth/token-provider` route could be:

**Option A**: Part of main vibes.diy app
- Pros: Shared Clerk provider, simpler deployment
- Cons: Loads full app bundle for minimal use

**Option B**: Separate entry point
- Create `vibes.diy/pkg/app/auth-provider-root.tsx`
- New Vite entry point in vite.config.ts
- Minimal bundle: Clerk + React only
- Pros: Faster load, smaller bundle
- Cons: More complex build configuration

**Recommendation**: Start with Option A, optimize to Option B if needed.

### 2. CORS Configuration

Ensure hosting worker allows:
```typescript
allowHeaders: [
  "Content-Type",
  "Authorization",
  "X-Vibes-Token", // Add this
  "X-Title",
  "HTTP-Referer",
],
```

---

## Security Checklist

- [ ] Validate parent window origin against whitelist
- [ ] Use HTTPS in production (no http://)
- [ ] Set short JWT expiry (60s max)
- [ ] Verify JWT signature on every request
- [ ] Check JWT issuer and audience claims
- [ ] Rate limit token exchange endpoint
- [ ] Log authentication events for monitoring
- [ ] Handle popup blockers gracefully
- [ ] Clear tokens when popup closes
- [ ] Implement token refresh on 401 errors

---

## Migration Path

### Phase 1: Add Support (Backward Compatible)
1. Deploy vibesTokenMiddleware alongside existing Clerk auth
2. Deploy /api/auth/exchange-token endpoint
3. Deploy /auth/token-provider popup route
4. Test with strudel.fp staging

### Phase 2: Update 3rd Party Apps
1. Update strudel.fp to use popup-based auth
2. Update any other 3rd party integrations
3. Monitor token usage and errors

### Phase 3: (Optional) Remove Legacy Support
1. If old Fireproof tokens were supported, can now remove
2. Consolidate to single auth pattern

---

## Testing Strategy

### Unit Tests
- JWT signing and verification
- Token expiry validation
- Origin whitelist validation
- Middleware user context setting

### Integration Tests
1. Open popup from test page
2. Verify token received via postMessage
3. Make API call with token
4. Verify request succeeds
5. Wait 60s, verify token expires
6. Verify new token received after 30s

### Manual Testing
1. Test with strudel.fp locally
2. Test popup close/reopen flow
3. Test with popup blockers enabled
4. Test network interruption recovery

---

## Open Questions

1. **Token Refresh Strategy**: Should parent request refresh, or popup push continuously?
   - **Current design**: Popup pushes every 30s (simpler for 3rd party)

2. **Multiple Tabs**: How to handle multiple strudel tabs?
   - **Option**: Shared service worker for token management
   - **Simple**: Each tab opens own popup (current design)

3. **Offline Handling**: What happens when vibes.diy is unreachable?
   - **Graceful degradation**: 3rd party app should handle missing tokens
   - **User messaging**: Show "AI features require connection" state

4. **Rate Limiting**: Should we limit token exchanges?
   - **Recommendation**: 120 requests/hour per user (2 per minute)
   - **Implementation**: Use Cloudflare Workers rate limiting

---

## Dependencies

### New Dependencies
```json
{
  "jose": "^6.1.1"  // Already in hosting/pkg/package.json ✅
}
```

### No new dependencies needed - jose is already installed!

---

## Implementation Checklist

### Backend (hosting package)
- [ ] Create `hosting/base/endpoints/auth-exchange-token.ts`
- [ ] Create `hosting/pkg/src/middleware/vibesTokenAuth.ts`
- [ ] Update `hosting/pkg/src/index.ts` to register endpoint and middleware
- [ ] Add X-Vibes-Token to CORS allowed headers
- [ ] Add tests for JWT validation
- [ ] Update QueueEnv interface if queue needs auth context

### Frontend (vibes.diy package)
- [ ] Create `vibes.diy/pkg/app/routes/auth.token-provider.tsx`
- [ ] Add route to React Router config
- [ ] Add origin whitelist configuration
- [ ] Create integration test page
- [ ] Update docs with integration guide

### Documentation
- [ ] Add to vibes.diy README: 3rd party integration section
- [ ] Create strudel.fp integration guide
- [ ] Document postMessage protocol
- [ ] Security best practices guide

---

## Example: Complete Integration Flow

```javascript
// In strudel.fp (3rd party app)

class VibesAuthManager {
  constructor() {
    this.popup = null;
    this.token = null;
    this.listeners = new Set();
  }

  async init() {
    return new Promise((resolve, reject) => {
      // Open popup
      this.popup = window.open(
        'https://vibes.diy/auth/token-provider',
        'vibes-auth',
        'width=400,height=500'
      );

      if (!this.popup) {
        reject(new Error('Popup blocked'));
        return;
      }

      // Listen for tokens
      const handleMessage = (event) => {
        if (event.origin !== 'https://vibes.diy') return;

        if (event.data.type === 'vibes-token') {
          this.token = event.data.token;
          window.CALLAI_API_KEY = this.token;

          // Notify listeners
          this.listeners.forEach(fn => fn(this.token));

          // Resolve on first token
          if (!this.resolved) {
            this.resolved = true;
            resolve(this.token);
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Timeout after 30s
      setTimeout(() => {
        if (!this.resolved) {
          reject(new Error('Authentication timeout'));
        }
      }, 30000);
    });
  }

  onTokenUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  close() {
    if (this.popup) {
      this.popup.close();
    }
  }
}

// Usage
const auth = new VibesAuthManager();
await auth.init(); // Opens popup, waits for first token

// Now make AI calls
const response = await callAI("Generate a beat", {
  endpoint: "https://vibes-diy-api.com/api/v1/chat/completions"
});
```

---

## Future Enhancements

### 1. Service Worker for Token Management
- Shared token pool across tabs
- Automatic refresh coordination
- Offline token caching (with expiry)

### 2. Token Revocation
- Add token ID (jti claim)
- Store active tokens in KV
- Revocation endpoint: `/api/auth/revoke-token`

### 3. Scoped Tokens
- Add `scope` claim for fine-grained permissions
- Example: `scope: ["ai:completions", "ai:images"]`
- Backend checks scope before allowing operations

### 4. Usage Tracking
- Log token usage in analytics
- Track which 3rd party apps are using APIs
- Monitor for abuse patterns
