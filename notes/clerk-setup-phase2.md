# Clerk Setup for Phase 2 Demo

## Environment Configuration

The Clerk publishable key is configured in `vibes.diy/pkg/app/config/env.ts`:

```typescript
// Clerk Auth (Phase 2)
export const CLERK_PUBLISHABLE_KEY = 
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 
  "pk_test_demo-clerk-key-for-phase2-testing";
```

## How Consumer Code Passes the Key

The vibes.diy app demonstrates the correct pattern:

### 1. Import from environment config
```typescript
import { CLERK_PUBLISHABLE_KEY } from '../config/env.js';
```

### 2. Pass to ClerkAuthProvider
```typescript
<ClerkAuthProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
  <LoginContent />
</ClerkAuthProvider>
```

## For Real Implementation

To use real Clerk authentication:

1. **Create Clerk Application**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com)
   - Create new application
   - Copy the publishable key (starts with `pk_`)

2. **Set Environment Variable**
   ```bash
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_real_clerk_key_here
   ```

3. **Configure Clerk Settings**
   - Add your domain to allowed origins
   - Configure sign-in/sign-up options
   - Set up OAuth providers if needed

## Current Phase 2 State

- ✅ Key is configurable from environment
- ✅ Clean consumer API (pass key to ClerkAuthProvider)
- ✅ Fallback demo key for development
- ⚠️ Import path needs resolution for testing (`@vibes.diy/use-vibes-base`)

The architecture is correct - just need to resolve the import path for actual testing.