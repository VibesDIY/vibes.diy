# Direct Catalog VibeCard Rendering

## Goal

Render `VibeCard.tsx` directly using data from `useCatalog` instead of going through the `VibeCardData.tsx` wrapper that loads from individual vibe databases.

## Current Flow (Inefficient)

```
mine.tsx
├── useCatalog() → catalogVibes: LocalVibe[]     // ✅ Already has all vibe data + screenshots
├── catalogVibes.map(vibe =>
│   └── <VibeCardData vibeId={vibe.id} />        // ❌ Redundant data loading!
│       ├── loadVibeDocument(vibe.id)            // ❌ Re-loads data we already have
│       ├── loadVibeScreenshot(vibe.id)          // ❌ Re-loads screenshot we already have
│       └── <VibeCard vibe={...} screenshot={...} />
│   )
```

**Problem**: We're doing double work! The catalog already has all the vibe data and screenshots, but we're still using `VibeCardData` which re-loads everything from individual vibe databases.

## Target Flow (Efficient)

```
mine.tsx
├── useCatalog() → catalogVibes: LocalVibe[]     // ✅ Already has all vibe data + screenshots
├── catalogVibes.map(vibe =>
│   └── <VibeCard                                // ✅ Direct rendering with catalog data
│         vibe={vibe}                           // ✅ Data from catalog
│         screenshot={vibe.screenshot}          // ✅ Screenshot from catalog
│         onEditClick={handleEditClick}         // ✅ Event handlers from parent
│         onToggleFavorite={handleToggleFavorite}
│         onDeleteClick={handleDeleteClick}
│         onRemixClick={handleRemixClick}
│       />
│   )
```

**Benefit**: Single data load from catalog, no redundant database queries.

## Current Catalog Data Structure

The `useCatalog` hook already returns `catalogVibes` as `LocalVibe[]` with the exact interface that `VibeCard` expects:

```typescript
// From useCatalog.ts transformToLocalVibe()
interface LocalVibe {
  id: string; // ✅ vibe.id
  title: string; // ✅ vibe.title
  encodedTitle: string; // ✅ vibe.encodedTitle
  slug: string; // ✅ vibe.slug
  created: string; // ✅ vibe.created (ISO string)
  favorite: boolean; // ❌ Currently hardcoded to false
  publishedUrl?: string; // ✅ vibe.publishedUrl
  screenshot?: {
    // ✅ vibe.screenshot
    file: () => Promise<File>;
    type: string;
  };
}
```

## Implementation Strategy

### Step 1: Extract Event Handlers from VibeCardData

Currently `VibeCardData` contains all the business logic for handling clicks. We need to move these handlers to the parent component (`mine.tsx`):

**From VibeCardData.tsx:**

```typescript
const handleEditClick = (id: string, encodedTitle: string) => {
  navigate(`/chat/${id}/${encodedTitle}/app`);
};

const handleToggleFavorite = async (vibeId: string, e: React.MouseEvent) => {
  // Optimistic update + toggleFavorite(vibeId)
};

const handleDeleteClick = async (vibeId: string, e: React.MouseEvent) => {
  // Confirmation logic + deleteVibe(vibeId)
};

const handleRemixClick = (slug: string, event: React.MouseEvent<HTMLButtonElement>) => {
  navigate(`/remix/${slug}`);
};
```

**Move to mine.tsx:**

```typescript
// Add these handlers to mine.tsx
const handleEditClick = useCallback(
  (id: string, encodedTitle: string) => {
    navigate(`/chat/${id}/${encodedTitle}/app`);
  },
  [navigate]
);

const handleToggleFavorite = useCallback(async (vibeId: string, e: React.MouseEvent) => {
  e.stopPropagation();
  e.preventDefault();
  // Update catalog vibe optimistically
  // Call toggleFavorite from useVibes
}, []);

// ... etc for other handlers
```

### Step 2: Fix Favorite Status in Catalog

The catalog currently hardcodes `favorite: false`. We need to:

**Option A**: Sync favorites into catalog during cataloging

```typescript
// In useCatalog.ts createCatalogDocument()
const userVibespaceDb = fireproof(`vu-${userId}`);
const userVibeDoc = await userVibespaceDb.get(`app-${vibe.id}`).catch(() => null);

return {
  _id: createCatalogDocId(vibe.id),
  // ... other fields
  favorite: userVibeDoc?.favorite || false, // ✅ Real favorite status
};
```

**Option B**: Lookup favorites in mine.tsx and merge

```typescript
// In mine.tsx
const catalogVibesWithFavorites = useMemo(async () => {
  const vibespaceDb = fireproof(`vu-${userId}`);
  return Promise.all(
    catalogVibes.map(async (vibe) => {
      const userVibeDoc = await vibespaceDb.get(`app-${vibe.id}`).catch(() => null);
      return { ...vibe, favorite: userVibeDoc?.favorite || false };
    })
  );
}, [catalogVibes, userId]);
```

### Step 3: Direct VibeCard Rendering

Replace `VibeCardData` usage with direct `VibeCard` rendering:

**Current:**

```tsx
{
  filteredVibes
    .slice(0, itemsToShow)
    .map((vibe) => <VibeCardData key={vibe.id} vibeId={vibe.id} />);
}
```

**Target:**

```tsx
{
  filteredVibes
    .slice(0, itemsToShow)
    .map((vibe) => (
      <VibeCard
        key={vibe.id}
        vibe={vibe}
        screenshot={vibe.screenshot}
        confirmDelete={confirmDelete}
        onEditClick={handleEditClick}
        onToggleFavorite={handleToggleFavorite}
        onDeleteClick={handleDeleteClick}
        onRemixClick={handleRemixClick}
      />
    ));
}
```

## Benefits

1. **Performance**: Single database query instead of N+1 queries
2. **Consistency**: Data comes from single source (catalog)
3. **Simplicity**: Fewer components in the chain
4. **Real-time**: Catalog updates automatically refresh all cards

## Challenges

1. **State Management**: Need to manage `confirmDelete` state in parent
2. **Favorite Sync**: Need to ensure catalog has correct favorite status
3. **Error Handling**: Need to handle errors at parent level instead of per-card
4. **Loading States**: Need unified loading for all cards instead of per-card

## Migration Path

1. **Phase 1**: Add event handlers to `mine.tsx` while keeping `VibeCardData`
2. **Phase 2**: Fix favorite status in catalog
3. **Phase 3**: Switch to direct `VibeCard` rendering
4. **Phase 4**: Remove `VibeCardData` (or keep for non-catalog scenarios)

## Alternative: Hybrid Approach

Keep `VibeCardData` but add a "catalog mode":

```typescript
interface VibeCardDataProps {
  vibeId: string;
  catalogVibe?: LocalVibe;  // If provided, skip loading
}

export function VibeCardData({ vibeId, catalogVibe }: VibeCardDataProps) {
  if (catalogVibe) {
    // Skip all loading, use provided data directly
    return <VibeCard vibe={catalogVibe} screenshot={catalogVibe.screenshot} ... />;
  }

  // Existing loading logic for non-catalog scenarios
}
```

This preserves existing functionality while optimizing the catalog case.

## Performance Impact

**Before**:

- 1 catalog query + N individual vibe queries + N screenshot queries = `1 + 2N` queries

**After**:

- 1 catalog query + (optional) 1 vibespace query for favorites = `1-2` queries

For 20 vibes: **41 queries → 2 queries** (95% reduction!)
