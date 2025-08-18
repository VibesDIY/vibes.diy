# VibeCardData Catalog Challenge

## Overview

The current `VibeCardData` component loads data from individual vibe databases (`vibe-${vibeId}`), but we want a version that loads from the centralized catalog database instead. This would be useful for:

- Published vibes on the firehose/public feeds
- Faster loading from a single database instead of multiple individual ones
- Consistent metadata from the catalog that may be enriched during publishing

## Current Architecture

### VibeCardData.tsx Current Flow

```
VibeCardData
├── loadVibeDocument(vibeId) → fireproof(`vibe-${vibeId}`) → get('vibe')
├── loadVibeScreenshot(vibeId) → fireproof(`vibe-${vibeId}`) → query('type', {key: 'screenshot'})
└── Renders VibeCard with LocalVibe data
```

### Data Loading Pattern

**Current (Individual Vibe DB):**

```typescript
// From vibeUtils.ts
export async function loadVibeDocument(vibeId: string): Promise<LocalVibe | null> {
  const db = fireproof('vibe-' + vibeId); // Individual database
  const vibeDoc = await db.get('vibe'); // Core vibe document
  return transformToLocalVibe(vibeDoc, vibeId);
}

export async function loadVibeScreenshot(vibeId: string) {
  const db = fireproof('vibe-' + vibeId); // Individual database
  const result = await db.query('type', {
    // Query screenshots
    key: 'screenshot',
    includeDocs: true,
    descending: true,
    limit: 1,
  });
  return result.rows[0]?.doc?._files?.screenshot;
}
```

**Target (Catalog DB):**

```typescript
// Proposed catalog-based loading
export async function loadCatalogVibe(userId: string, vibeId: string): Promise<LocalVibe | null> {
  const catalogDb = getCatalogDatabase(userId); // Centralized catalog
  const catalogDoc = await catalogDb.get(createCatalogDocId(vibeId)); // Single doc
  return transformToLocalVibe(catalogDoc); // Already has screenshot
}
```

## Key Challenges

### 1. **Database Structure Differences**

**Individual Vibe DB Structure:**

```
vibe-${vibeId}/
├── vibe                    // Main document with title, created_at, etc.
├── screenshot-${id}        // Separate screenshot documents
└── message-${id}          // Chat messages (not needed for card)
```

**Catalog DB Structure:**

```
vibez-catalog-${userId}/
├── catalog-${vibeId}      // Combined document with metadata + files
│   ├── title, created, url
│   ├── _files.screenshot  // Embedded screenshot file
│   └── _files.source     // Embedded source code
```

### 2. **Favorite Status Synchronization**

- **Current**: Favorite status stored in individual vibe DB + user vibespace DB
- **Catalog**: Favorite status needs to be synced/queried from user vibespace DB
- **Challenge**: How to efficiently load favorite status for catalog vibes?

```typescript
// Current approach gets favorite from vibeDoc itself
const vibe = await loadVibeDocument(vibeId); // Has favorite: boolean

// Catalog approach needs separate favorite lookup
const catalogVibe = await loadCatalogVibe(userId, vibeId);
const vibespaceDb = fireproof(`vu-${userId}`);
const userVibeDoc = await vibespaceDb.get(`app-${vibeId}`);
catalogVibe.favorite = userVibeDoc?.favorite || false;
```

### 3. **User Context Requirements**

- **Current**: Only needs `vibeId`
- **Catalog**: Needs both `userId` and `vibeId` to access correct catalog DB
- **Challenge**: How to get userId in components that currently only take vibeId?

```typescript
// Current interface
interface VibeCardDataProps {
  vibeId: string;
}

// Catalog version would need
interface CatalogVibeCardDataProps {
  vibeId: string;
  userId: string; // Additional requirement!
}
```

### 4. **Data Availability Timing**

- **Individual DB**: Data exists as soon as vibe is created
- **Catalog DB**: Data only exists after being cataloged by useCatalog hook
- **Challenge**: Catalog may not have data for very new vibes

### 5. **Permission & Access Patterns**

- **Individual DB**: Direct access to `vibe-${vibeId}`
- **Catalog DB**: Access to `vibez-catalog-${userId}` (user-specific)
- **Challenge**: Public/cross-user access patterns for published vibes

```typescript
// For user's own vibes - straightforward
const myVibes = await loadFromCatalog(myUserId, vibeId);

// For published vibes from other users - complex
const publishedVibes = await loadFromCatalog(otherUserId, vibeId); // Need their userId!
```

## Implementation Strategy

### Option A: Parallel Component (CatalogVibeCardData)

Create a new component `CatalogVibeCardData` alongside existing `VibeCardData`:

**Pros:**

- No risk to existing functionality
- Clear separation of concerns
- Can optimize for catalog-specific use cases

**Cons:**

- Code duplication between components
- Need to maintain two similar components

### Option B: Unified Component with Source Parameter

Add a `source` prop to determine data loading strategy:

```typescript
interface VibeCardDataProps {
  vibeId: string;
  userId?: string; // Required for catalog mode
  source?: 'vibe' | 'catalog'; // Default: 'vibe'
}
```

**Pros:**

- Single component to maintain
- Gradual migration path

**Cons:**

- More complex component logic
- Harder to optimize for specific use cases

### Option C: Hook-Based Abstraction

Create a `useVibeData` hook that abstracts the loading strategy:

```typescript
const useVibeData = (
  vibeId: string,
  options?: {
    source?: 'vibe' | 'catalog';
    userId?: string;
  }
) => {
  // Returns same LocalVibe interface regardless of source
};
```

**Pros:**

- Clean separation of data loading logic
- Easy to switch strategies
- Reusable across components

**Cons:**

- More abstraction layers
- Need to handle different loading patterns

## Open Questions

1. **Fallback Strategy**: If catalog doesn't have the vibe, should we fall back to individual DB?

2. **Cache Strategy**: How to handle caching between catalog and individual DBs?

3. **Real-time Updates**: How to handle updates when vibe is modified in individual DB but catalog hasn't synced?

4. **Performance**: Is single catalog lookup actually faster than individual DB access?

5. **User Context**: In public/firehose scenarios, how do we determine which user's catalog to query?

## Related Files

- `/app/components/VibeCardData.tsx` - Current implementation
- `/app/utils/vibeUtils.ts` - Current vibe loading utilities
- `/app/hooks/useCatalog.ts` - Catalog management and data structure
- `/app/utils/catalogUtils.ts` - Shared catalog utilities
- `/app/routes/mine.tsx` - Uses useCatalog for vibe listing
