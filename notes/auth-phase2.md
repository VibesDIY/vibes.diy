# Phase 2 Plan: Working Clerk Auth Experience

## Overview
This phase creates a working Clerk authentication experience through Phase 2, culminating in a new /login route in vibes.diy that demonstrates inline auth. No Fireproof token integration yet - that's Phase 3.

## Key Insight: CLOUD_SESSION_TOKEN_PUBLIC_KEY Already Available
The Fireproof public key needed for token compatibility is already configured in `vibes.diy/pkg/app/config/env.ts` as `CLOUD_SESSION_TOKEN_PUBLIC_KEY`. This will be used in Phase 2 for Clerk config.

## Phase 1.2-1.3: Setup Dependencies & Structure

### Step 1.2: Install Clerk in use-vibes-base
- Add `@clerk/clerk-react` to `use-vibes/base/package.json` dependencies
- This keeps Clerk isolated to the base package, not polluting vibes.diy

### Step 1.3: Create auth module structure in use-vibes-base
```
use-vibes/base/
└── auth/
    ├── components/
    │   ├── ClerkAuthProvider.tsx
    │   └── VibesClerkAuth.tsx  
    ├── hooks/
    │   └── useClerkAuth.ts
    └── index.ts
```

## Phase 2: Working Clerk Auth Components

### Step 2.1: Create ClerkAuthProvider component
- Wraps Clerk's `<ClerkProvider>` with vibes-specific config
- Handles publishable key configuration
- Provides auth context to child components
- **Key point**: Uses existing environment pattern from vibes.diy

### Step 2.2: Create VibesClerkAuth component  
- Modal-based UI with Vibes branding (similar to NeedsLoginModal)
- Uses Clerk's `<SignIn>` and `<SignUp>` components
- Matches existing vibes.diy styling patterns
- Responsive design for mobile/desktop

### Step 2.3: Create useClerkAuth hook
- Exposes clean API: `{ isAuthenticated, user, initiateLogin, logout }`  
- Wraps Clerk's `useAuth()` and `useUser()` hooks
- **No Fireproof token conversion yet** - just Clerk auth state
- Provides foundation for Phase 3 token integration

### Step 2.4: Export auth components from use-vibes-base
- Add exports in `use-vibes/base/index.ts`
- Keep separate from main useFireproof hook for now
- Clean API surface for consuming applications

## Phase 2 Demo: New /login Route in vibes.diy

### Step 2.5: Create /login route in vibes.diy app
- Create `vibes.diy/pkg/app/routes/login.tsx`
- Imports `{ ClerkAuthProvider, VibesClerkAuth }` from use-vibes-base
- Renders inline Clerk auth form instead of popup
- Uses existing app styling/layout patterns from SimpleAppLayout
- Handles success/error states

### Step 2.6: Update vibes.diy to test the experience
- Add navigation to `/login` from existing auth triggers
- Temporarily modify NeedsLoginModal to navigate instead of popup
- Can still fall back to popup auth if needed during development
- Test the complete user flow

## Milestone Achievement: Working Login Experience

At Phase 2 completion we have:
- ✅ Clerk authentication working in vibes.diy app
- ✅ Inline `/login` route instead of popup windows
- ✅ Vibes-branded auth UI components matching existing design
- ✅ Clean separation: Clerk only in use-vibes-base, not vibes.diy/pkg  
- ✅ Foundation for Phase 3 Fireproof token integration
- ❌ Not yet: Fireproof token conversion (Phase 3)

## Prerequisites for Success

### Environment Setup
- Clerk publishable key configured in vibes.diy environment
- `CLOUD_SESSION_TOKEN_PUBLIC_KEY` already available for Phase 3
- Clerk project configured with proper domains/redirects

### Technical Requirements
- Clerk project set up with vibes.diy domain
- Public keys from Fireproof team for token signing (Phase 3)
- Test environment for validating auth flow

## Benefits of This Approach

1. **Incremental validation** - Test UX before complex token logic
2. **Clean architecture** - Clerk isolated to use-vibes-base package
3. **Reusable components** - VibesClerkAuth can be used in any app
4. **Familiar patterns** - Builds on existing vibes.diy auth UX
5. **Easy rollback** - Popup auth remains available during development

This approach lets us validate the user experience and component architecture before tackling the complex Fireproof token conversion in Phase 3.