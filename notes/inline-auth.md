# Refined Plan: Implement Inline Clerk Auth in use-vibes Package

## Phase 1: Foundation Setup
1. **Move useFireproof customization** from `use-vibes/base/index.ts` to `use-vibes/pkg/index.ts`
2. **Install Clerk dependencies** in use-vibes package
3. **Create auth module structure** in `use-vibes/base/`

## Phase 2: Core Auth Components  
4. **Create VibesClerkAuth component** - Modal-based auth UI with Vibes branding
5. **Create ClerkAuthProvider** - Wrapper that integrates Clerk with existing auth patterns
6. **Create useClerkAuth hook** - Bridge between Clerk and Fireproof token systems

## Phase 3: Enhanced useFireproof Hook
7. **Extend useFireproof options** to accept `enableClerkAuth` and auth config
8. **Implement ClerkRedirectStrategy** that works with existing RedirectStrategy patterns
9. **Add token conversion utilities** - Convert Clerk JWTs to Fireproof-compatible format

## Phase 4: Integration Features
10. **Add credit system integration** - Trigger auth when credits needed
11. **Implement analytics tracking** - Track auth events like existing system
12. **Add toast notifications** - Success/error messaging consistent with vibes.diy

## Phase 5: Developer Experience
13. **Create minimal setup examples** - Show zero-config auth usage
14. **Add TypeScript definitions** - Comprehensive types for auth options
15. **Write documentation** - Guide for enabling Clerk auth in useFireproof

## Key Design Decisions
- **Leverage existing auth patterns** from vibes.diy AuthContext rather than rebuilding
- **Maintain token compatibility** with current base58btc/JOSE format  
- **Use modal-based UI** consistent with existing NeedsLoginModal patterns
- **Keep it optional** - Auth remains opt-in via `enableClerkAuth: true`
- **Reuse verification logic** from existing `verifyToken`/`extendToken` functions

## Expected Developer Usage
```typescript
const { database } = useFireproof('my-app', {
  enableClerkAuth: true,
  tenant: 'vibes-music',
  authConfig: {
    clerkPublishableKey: process.env.CLERK_KEY,
    onAuthRequired: () => console.log('Auth needed')
  }
});
```

## Integration Points with Existing Auth System

The vibes.diy app already has a sophisticated auth system that should inform our approach:

### AuthContext Patterns
- **Token verification** using JOSE/ES256 algorithm
- **Base58btc token encoding** for Fireproof compatibility  
- **Auto token extension** logic when tokens near expiration
- **Credit system integration** that triggers auth requirements

### UX Patterns to Follow
- **Modal-based auth prompts** (similar to NeedsLoginModal)
- **Analytics tracking** for auth events (trackAuthClick)
- **Toast notifications** for auth success/failure
- **Loading states** during auth operations

### Token Format Compatibility
Ensure generated tokens include the same payload structure:
```typescript
interface TokenPayload {
  userId: string;
  tenants: { id: string; role: string; }[];
  ledgers: { id: string; role: string; right: string; }[];
  iat: number;
  iss: string;
  aud: string;
  exp: number;
}
```

## Proposed Component Structure

```
use-vibes/base/
├── components/
│   ├── auth/
│   │   ├── VibesClerkAuth.tsx
│   │   ├── AuthModal.tsx
│   │   └── AuthProvider.tsx
│   └── ...existing
├── hooks/
│   ├── auth/
│   │   ├── useClerkAuth.ts
│   │   ├── useAuthModal.ts
│   │   └── index.ts
│   └── ...existing
└── utils/
    ├── auth/
    │   ├── clerkFireproofBridge.ts
    │   ├── tokenUtils.ts
    │   └── index.ts
    └── ...existing
```

This approach builds on proven patterns from the existing vibes.diy auth system while providing the simplified developer experience described in issue #297.