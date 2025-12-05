# Simplified Clerk Provider Implementation

## Goal

Simplify the Clerk integration for Fireproof sync from 160 lines down to ~30 lines by leveraging DashboardApi's built-in token management.

## Key Insight

> "if you use the DashboardApi from fireproof then you get that for free with:
>     const clerk = useClerk() as Clerk;
>     this.dashApi = clerkDashApi(clerk, { apiUrl: DASHAPI_URL });
> the dashApi is then setuped with token and as yesterday you can call ensureCloudToken as often as you want.
> your strategy is now down to one line: you need to get dashApi from your provider and then
> just call ensureCloudToken() --- no-caching ---- call it as often as you want.
> so the strategy should be down to 10-20 lines"

**What to Remove:**
- ❌ Future pattern for token resolution (DashboardApi handles this)
- ❌ Token caching logic (ensureCloudToken handles this internally)
- ❌ Complex Lazy factories (just create dashApi once)
- ❌ globalClerkStrategy singleton (use React Context instead)

**What to Keep:**
- ✅ Basic TokenStrategie interface implementation
- ✅ Simple ClerkTokenStrategy class (~30 lines)
- ✅ React Context for DashboardApi

## Implementation Plan

### 1. Simplify ClerkTokenStrategy (160 lines → ~30 lines)

**File:** `use-vibes/base/clerk-token-strategy.ts`

```typescript
import type {
  TokenStrategie,
  TokenAndClaims,
  ToCloudOpts,
} from '@fireproof/core-types-protocols-cloud';
import { type Logger, Lazy } from '@adviser/cement';
import type { SuperThis } from '@fireproof/core-types-base';
import type { DashboardApi } from '@fireproof/core-protocols-dashboard';
import { hashObjectSync } from '@fireproof/core-runtime';

/**
 * Simplified ClerkTokenStrategy - just calls dashApi.ensureCloudToken()
 * No caching, no Future pattern - DashboardApi handles everything
 */
export class ClerkTokenStrategy implements TokenStrategie {
  private deviceId?: string;

  constructor(private dashApi: DashboardApi) {}

  readonly hash = Lazy(() => hashObjectSync({ strategy: 'clerk' }));

  open(_sthis: SuperThis, _logger: Logger, deviceId: string): void {
    this.deviceId = deviceId;
  }

  async tryToken(_sthis: SuperThis, logger: Logger): Promise<TokenAndClaims | undefined> {
    if (!this.dashApi || !this.deviceId) return undefined;

    const result = await this.dashApi.ensureCloudToken({
      appId: this.deviceId,
      env: 'prod',
    });

    if (result.isErr()) {
      logger?.Error().Err(result.Err()).Msg('ensureCloudToken failed');
      return undefined;
    }

    return { token: result.Ok().cloudToken };
  }

  async waitForToken(sthis: SuperThis, logger: Logger, _deviceId: string, opts: ToCloudOpts): Promise<TokenAndClaims | undefined> {
    return this.tryToken(sthis, logger, opts);
  }

  stop(): void {
    this.deviceId = undefined;
  }
}
```

### 2. Add React Context for DashboardApi

**File:** `use-vibes/base/contexts/VibeContext.tsx`

Add these sections:

```typescript
import { useState } from 'react';
import type { DashboardApi } from '@fireproof/core-protocols-dashboard';
import { DashboardApi as DashboardApiImpl } from '@fireproof/core-protocols-dashboard';

// Create context for DashboardApi
const DashboardApiContext = createContext<DashboardApi | null>(null);

export function useDashboardApi() {
  return useContext(DashboardApiContext);
}

// Simple helper to create DashboardApi (NOT a Lazy factory)
function clerkDashApi(clerk: Clerk, apiUrl: string): DashboardApi {
  const getToken = async () => {
    const token = await clerk.session?.getToken({ template: 'with-email' });
    return { type: 'clerk' as const, token: token || '' };
  };

  return new DashboardApiImpl({
    apiUrl,
    getToken,
    fetch: fetch.bind(globalThis),
  });
}

// Make VibeClerkIntegration a provider component (NOT side-effect only)
export function VibeClerkIntegration({ children }: { children: ReactNode }) {
  const vibeMetadata = useVibeContext();
  const { session, isLoaded } = useSession();
  const clerk = useClerk();
  const [dashApi, setDashApi] = useState<DashboardApi | null>(null);

  useEffect(() => {
    // Add isLoaded check to prevent race condition
    if (isLoaded && session && clerk && vibeMetadata) {
      const api = clerkDashApi(clerk, getApiUrl());
      setDashApi(api);
    }
  }, [isLoaded, session, clerk, vibeMetadata]);

  return (
    <DashboardApiContext.Provider value={dashApi}>
      {children}
    </DashboardApiContext.Provider>
  );
}
```

### 3. Update useFireproof to Use Context

**File:** `use-vibes/base/index.ts`

```typescript
import { useDashboardApi } from './contexts/VibeContext.js';
import { ClerkTokenStrategy } from './clerk-token-strategy.js';

export function useFireproof(nameOrDatabase?: string | Database) {
  const vibeMetadata = useVibeContext();
  const dashApi = useDashboardApi(); // GET from context

  // Construct augmented database name
  const augmentedDbName = constructDatabaseName(nameOrDatabase, vibeMetadata);

  // Only create strategy if dashApi is available
  const strategy = dashApi ? new ClerkTokenStrategy(dashApi) : undefined;

  const attachConfig = strategy
    ? toCloud({ tokenStrategy: strategy })
    : undefined;

  // Use original useFireproof with strategy
  const result = originalUseFireproof(
    augmentedDbName,
    attachConfig ? { attach: attachConfig } : {}
  );

  // ... rest of hook
}
```

Also export `useDashboardApi`:

```typescript
export {
  VibeContextProvider,
  VibeClerkIntegration,
  useVibeContext,
  useDashboardApi,  // ADD THIS
  // ...
}
```

### 4. Update vibe-viewer to Wrap with Provider

**File:** `vibes.diy/pkg/app/routes/vibe-viewer.tsx`

Change VibeClerkIntegration from sibling to wrapper:

```typescript
import { mountVibeWithCleanup, VibeClerkIntegration } from "use-vibes";

function VibeInstanceViewerContent() {
  // ... existing code ...

  return (
    <VibeClerkIntegration>  {/* WRAP children */}
      <div className="relative w-full h-screen bg-gray-900">
        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            {/* ... error UI ... */}
          </div>
        )}

        {/* Container for vibe module */}
        <div id={containerId} className="w-full h-full" />
      </div>
    </VibeClerkIntegration>
  );
}
```

## Race Conditions Fixed

1. ✅ **Session Loading** - Added `isLoaded` check before creating DashboardApi
2. ✅ **DashboardApi Availability** - React Context ensures dashApi is available before useFireproof creates strategy
3. ✅ **Token Caching** - Let DashboardApi.ensureCloudToken handle all caching (called as often as needed)
4. ✅ **Component Mounting Order** - Provider pattern ensures dashApi is in context before children render

## Files Modified

1. **`use-vibes/base/clerk-token-strategy.ts`** - Simplify from 160 to ~40 lines
2. **`use-vibes/base/contexts/VibeContext.tsx`** - Add DashboardApiContext and make VibeClerkIntegration a provider
3. **`use-vibes/base/index.ts`** - Use useDashboardApi hook and create strategy with context
4. **`vibes.diy/pkg/app/routes/vibe-viewer.tsx`** - Wrap with VibeClerkIntegration provider

## Benefits

- **Less code**: 160 lines → ~40 lines for strategy (120 line reduction)
- **Less complexity**: No Future pattern, no Lazy factories, no singleton
- **More React-friendly**: Uses standard Context pattern
- **More testable**: Can mock dashApi in context provider
- **Matches dashboard pattern**: Uses clerkDashApi exactly as lead engineer described
- **Fixes race conditions**: isLoaded check + provider pattern ensures proper initialization order

## Dependencies (Add Later)

After simplification, add these to `use-vibes/base/package.json`:

```json
{
  "dependencies": {
    "@adviser/cement": "^0.5.2",  // UPDATE from 0.4.66
    "@clerk/clerk-react": "^5.57.0",  // ADD
    "@fireproof/core-protocols-dashboard": "0.24.0"  // ADD
  }
}
```

Then run:
```bash
pnpm install
pnpm check
```
