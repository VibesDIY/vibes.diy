# Use-Vibes Module Architecture

## Enhanced useFireproof Hook Strategy

From commit `8509d99` (Sept 17, 2025), use-vibes provides an **enhanced version** of `useFireproof` that serves as a drop-in replacement with additional sync capabilities.

### Original vs Enhanced Behavior

```typescript
// Original use-fireproof behavior:
const { database, useLiveQuery } = useFireproof("mydb");

// Enhanced use-vibes behavior (drop-in replacement):
const { database, useLiveQuery, enableSync, disableSync, syncEnabled } = useFireproof("mydb");
```

### Key Enhancements Added

1. **Local-first behavior** - starts without sync by default
2. **syncEnabled** state - tracks current sync status
3. **Persistent preferences** - remembers sync choice in localStorage
4. **enableSync()** and **disableSync()** functions - Stub functions (not yet implemented, will use Clerk token)

## Module Integration Architecture

```
use-vibes/pkg/index.ts (public API)
├── Re-exports from @vibes.diy/use-vibes-base
└── Adds RuntimeError interface

@vibes.diy/use-vibes-base/index.ts (core implementation)
├── Enhanced useFireproof hook (wraps original)
├── toCloud helper
├── ImgGen components and utilities
└── Re-exports from use-fireproof + call-ai
```

## Enhanced useFireproof Implementation Details

The use-vibes `useFireproof` is a **wrapper** around the original that adds:

1. **Automatic sync for returning users** - attaches cloud sync if previously enabled
2. **State tracking** - tracks sync status using React state
3. **Persistence** - uses localStorage to remember user's sync preference across sessions

## Drop-in Replacement Strategy

For users who change their import from `use-fireproof` to `use-vibes`, the enhanced version provides:

- **Same API surface** - all original useFireproof functionality preserved
- **Automatic sync for returning users** - cloud sync enabled automatically if previously used
- **Sync status tracking** - `syncEnabled` boolean indicates current sync state
- **Stub sync functions** - `enableSync()`/`disableSync()` are exported but not yet implemented (TODO: will use Clerk token)
- **Backward compatibility** - existing code continues to work without changes

**Important Notes:**

- No manual sync triggers currently implemented
- Future implementation will use Clerk authentication tokens
- Automatic ledger naming based on vibe metadata (titleId + installId)
