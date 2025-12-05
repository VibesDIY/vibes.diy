# Fix VibeContext Clerk Integration Using Dashboard Pattern

## Current Problem

VibeContextProvider calls `useSession()` and `useClerk()` hooks unconditionally, which throws an error when the component is mounted outside of `<ClerkProvider>`:

```
Error: useSession can only be used within the <ClerkProvider /> component.
```

This breaks the inline vibe rendering use case (via `mountVibesApp`) where vibes are mounted without the full vibe-viewer ClerkProvider context.

## Root Cause

The VibeContextProvider in `use-vibes/base/contexts/VibeContext.tsx` was designed assuming it would always be inside a ClerkProvider, but it's actually used in two contexts:

1. **vibe-viewer context**: Has ClerkProvider, needs auth and sync
2. **inline rendering**: No ClerkProvider, should gracefully degrade (no sync)

## Solution: Dashboard Cloud-Context Pattern

The Fireproof dashboard solved this same problem using a class-based pattern that isolates hook calls. Key insights from `fireproof/dashboard/frontend/src/cloud-context.ts`:

1. **Isolate hooks in initContext()**: Call Clerk hooks in a dedicated method
2. **Optional chaining everywhere**: Use `?.` for defensive null safety
3. **Token factory pattern**: Pass `getToken()` callback to DashboardApi
4. **Session ready checks**: Verify `isLoaded` and `isSignedIn` before using API

## Proposed Refactoring

### Option A: Class-Based VibeContext (Dashboard Pattern)

Create a `VibeContext` class similar to `CloudContext`:

```typescript
// use-vibes/base/contexts/VibeContext.ts
export class VibeContext {
  private _clerkSession?: ReturnType<typeof useSession>;
  private _clerk?: ReturnType<typeof useClerk>;

  constructor(public metadata: VibeMetadata) {}

  // Called from VibeContextProvider during render
  initContext() {
    // Only call hooks when inside provider - React will handle the error if not
    this._clerkSession = useSession();
    this._clerk = useClerk();
  }

  sessionReady(): boolean {
    return !!(this._clerkSession?.isLoaded && this._clerkSession?.isSignedIn);
  }

  async setupDashboardApi() {
    if (this.sessionReady() && this._clerk) {
      const dashApi = clerkDashApi(this._clerk, getApiUrl());
      globalClerkStrategy().setDashboardApi(dashApi);
    }
  }
}
```

**Provider component:**

```typescript
export function VibeContextProvider({ metadata, children }: VibeContextProviderProps) {
  const [vibeContext] = useState(() => new VibeContext(metadata));

  // Call hooks via initContext - will throw if not inside ClerkProvider
  vibeContext.initContext();

  useEffect(() => {
    vibeContext.setupDashboardApi();
  }, [vibeContext._clerkSession?.session, vibeContext._clerk]);

  return <VibeContextReactContext.Provider value={vibeContext}>{children}</VibeContextReactContext.Provider>;
}
```

### Option B: Simpler - Wrap in Error Boundary

Keep current implementation but wrap VibeContextProvider usage in an error boundary that catches Clerk errors:

```typescript
// use-vibes/base/vibe-app-mount.tsx
function VibesApp({ showVibesSwitch, vibeMetadata, children }) {
  const content = showVibesSwitch ? (
    <HiddenMenuWrapper menuContent={<VibesPanel />} showVibesSwitch={true}>
      {children}
    </HiddenMenuWrapper>
  ) : (
    <>{children}</>
  );

  if (vibeMetadata) {
    return (
      <ErrorBoundary fallback={content}>
        <VibeContextProvider metadata={vibeMetadata}>{content}</VibeContextProvider>
      </ErrorBoundary>
    );
  }

  return content;
}
```

### Option C: Two Providers (Recommended)

Split into two providers:
- `VibeContextProvider` - No Clerk dependency, just provides metadata
- `VibeClerkIntegration` - Separate component that handles Clerk hooks

```typescript
// VibeContextProvider - always safe to use
export function VibeContextProvider({ metadata, children }: VibeContextProviderProps) {
  return <VibeContext.Provider value={{ metadata }}>{children}</VibeContext.Provider>;
}

// VibeClerkIntegration - only use inside ClerkProvider
export function VibeClerkIntegration() {
  const vibeMetadata = useVibeContext();
  const { session } = useSession();
  const clerk = useClerk();

  useEffect(() => {
    if (session?.session && clerk && vibeMetadata) {
      const dashApi = clerkDashApi(clerk, getApiUrl());
      globalClerkStrategy().setDashboardApi(dashApi);
    }
  }, [session?.session, clerk, vibeMetadata]);

  return null; // This is just a side-effect component
}
```

**Usage in vibe-viewer.tsx:**
```typescript
<VibeContextProvider metadata={metadata}>
  <VibeClerkIntegration /> {/* Only here, inside ClerkProvider */}
  {children}
</VibeContextProvider>
```

**Usage in vibe-app-mount.tsx:**
```typescript
// Just VibeContextProvider, no VibeClerkIntegration
<VibeContextProvider metadata={vibeMetadata}>{content}</VibeContextProvider>
```

## Recommended Approach: Option C

**Why Option C is best:**

1. **Separation of concerns**: Metadata context is independent of auth
2. **Opt-in Clerk**: Only use VibeClerkIntegration when you need sync
3. **Clear API**: Explicit about when Clerk is required
4. **No error boundaries**: Cleaner than catching errors
5. **Easier testing**: Can test VibeContext without mocking Clerk

## Implementation Plan

### 1. Split VibeContext.tsx into two components

**File: use-vibes/base/contexts/VibeContext.tsx**

Current code (lines 108-126):
```typescript
export function VibeContextProvider({ metadata, children }: VibeContextProviderProps) {
  const sessionResult = useSession();
  const clerk = useClerk();

  useEffect(() => {
    if (sessionResult?.session && clerk) {
      const dashApi = clerkDashApi(clerk, getApiUrl());
      globalClerkStrategy().setDashboardApi(dashApi);
    }
  }, [sessionResult?.session, clerk]);

  return <VibeContext.Provider value={{ metadata }}>{children}</VibeContext.Provider>;
}
```

**Change to:**
```typescript
export function VibeContextProvider({ metadata, children }: VibeContextProviderProps) {
  return <VibeContext.Provider value={{ metadata }}>{children}</VibeContext.Provider>;
}

// New component - only use inside ClerkProvider
export function VibeClerkIntegration() {
  const vibeMetadata = useVibeContext();
  const { session } = useSession();
  const clerk = useClerk();

  useEffect(() => {
    if (session?.session && clerk && vibeMetadata) {
      const dashApi = clerkDashApi(clerk, getApiUrl());
      globalClerkStrategy().setDashboardApi(dashApi);
    }
  }, [session?.session, clerk, vibeMetadata]);

  return null;
}
```

### 2. Update exports in index.ts

**File: use-vibes/base/index.ts**

Add to exports (after line 434):
```typescript
export { VibeClerkIntegration } from './contexts/VibeContext.js';
```

### 3. Add VibeClerkIntegration to vibe-viewer.tsx

**File: vibes.diy/pkg/app/routes/vibe-viewer.tsx**

After line 8, add import:
```typescript
import { useVibeInstances } from "../hooks/useVibeInstances.js";
import { useAuth } from "@clerk/clerk-react";
import { mountVibeWithCleanup, VibeClerkIntegration } from "use-vibes"; // Add VibeClerkIntegration
```

In VibeInstanceViewerContent component, wrap the container div (around line 197):
```typescript
return (
  <div className="relative w-full h-screen bg-gray-900">
    <VibeClerkIntegration /> {/* Add this - sets up DashboardApi when session ready */}

    {/* Error Overlay */}
    {error && (
      ...
    )}

    {/* Container for vibe module to mount into */}
    <div id={containerId} className="w-full h-full" />
  </div>
);
```

### 4. Verify vibe-app-mount.tsx doesn't need changes

**File: use-vibes/base/vibe-app-mount.tsx**

Current code already correctly only uses VibeContextProvider (line 51):
```typescript
if (vibeMetadata) {
  return <VibeContextProvider metadata={vibeMetadata}>{content}</VibeContextProvider>;
}
```

No changes needed - this is the inline rendering case that doesn't need Clerk.

### 5. Update root.tsx (Optional - for global sync)

**File: vibes.diy/pkg/app/root.tsx**

If we want VibeContext available globally in root.tsx, we could add it to the provider chain. However, since VibeContext needs metadata (titleId/installId), it's better to keep it scoped to vibe-viewer routes only.

**No changes needed to root.tsx** - VibeContext remains route-specific.

## Testing Strategy

1. **Test inline rendering** (no ClerkProvider):
   - Verify mountVibesApp works without errors
   - Verify sync is disabled (syncEnabled = false)

2. **Test vibe-viewer** (with ClerkProvider):
   - Verify authentication flows work
   - Verify DashboardApi is set up correctly
   - Verify sync is enabled when authenticated

3. **Test tests**:
   - Run existing test suite
   - Tests that don't need Clerk should continue working
   - Tests in vibe-viewer context should work with Clerk

## Files to Modify

1. **use-vibes/base/contexts/VibeContext.tsx** - Split into two components
2. **use-vibes/base/index.ts** - Export VibeClerkIntegration
3. **vibes.diy/pkg/app/routes/vibe-viewer.tsx** - Add VibeClerkIntegration component
4. **Tests** - May need to add VibeClerkIntegration to some test setups

## Benefits

✅ **No error when mounting outside ClerkProvider**
✅ **Explicit opt-in for Clerk features**
✅ **Cleaner separation of concerns**
✅ **Easier to test**
✅ **Follows dashboard pattern philosophy**
✅ **No error boundaries needed**
✅ **Clear when sync will be available**
