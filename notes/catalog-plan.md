# Catalog Fix Plan: Complete Vibe Data with Bulk Write

## Problem Analysis

### Current State Issues

1. **Missing Titles**: Catalog documents show `title: undefined` because `useVibes()` only provides session IDs
2. **Incomplete Data**: Catalog lacks `publishedUrl`, proper `created_at`, and other vibe metadata
3. **Inefficient Operations**: Separate loops for catalog creation and screenshot sync
4. **IndexedDB Dependencies**: My vibes page falls back to IndexedDB when catalog data is incomplete

### Root Cause

The `useCatalog` hook depends on `useVibes()` which only returns:

```js
[{id: 'sessionId1'}, {id: 'sessionId2'}, ...]
```

But catalog documents need full vibe metadata from the actual `VibeDocument` stored in each session database.

## Solution Strategy

### Keep Session ID Discovery

- Continue using `useVibes()` to discover which sessions exist
- This maintains compatibility with existing session management

### Enhance Data Collection

- For each session ID, open the session database: `fireproof('vibe-${sessionId}')`
- Query for the `VibeDocument` with `_id: 'vibe'`
- Query for screenshots with `type: 'screenshot'`
- Compose complete catalog documents with all necessary data

### Single Bulk Write Operation

- Collect all data first (vibe docs + screenshots + CIDs)
- Create complete catalog documents in memory
- Perform single bulk write with chunking (max 10 docs per chunk)
- Eliminate separate screenshot sync loop

## Implementation Details

### Data Collection Flow

```js
// For each uncataloged vibe
for (const vibe of uncatalogedVibes) {
  // 1. Get session database
  const sessionDb = fireproof(`vibe-${vibe.id}`);

  // 2. Get full vibe document
  const vibeDoc = await sessionDb.get('vibe').catch(() => null);

  // 3. Get latest screenshot
  const screenshotResult = await sessionDb.query('type', {
    key: 'screenshot',
    includeDocs: true,
    descending: true,
    limit: 1,
  });

  // 4. Compose complete catalog document
  const catalogDoc = {
    _id: `catalog-${vibe.id}`,
    created: vibeDoc?.created_at || Date.now(),
    userId,
    vibeId: vibe.id,
    title: vibeDoc?.title || 'Untitled',
    url: vibeDoc?.publishedUrl,
  };

  // 5. Add screenshot and CID if available
  if (screenshotResult.rows.length > 0) {
    const screenshotDoc = screenshotResult.rows[0].doc;
    if (screenshotDoc._files?.screenshot && screenshotDoc.cid) {
      catalogDoc._files = {
        screenshot: screenshotDoc._files.screenshot,
      };
      catalogDoc.screenshotCid = screenshotDoc.cid;
    }
  }

  catalogDocsToCreate.push(catalogDoc);
}
```

### Bulk Write with Chunking

```js
// Write in chunks of 10 documents
const chunkSize = 10;
for (let i = 0; i < catalogDocsToCreate.length; i += chunkSize) {
  if (cancelled) break;
  const chunk = catalogDocsToCreate.slice(i, i + chunkSize);
  await database.bulk(chunk);
}
```

## Expected Benefits

### Complete Catalog Data

- Proper titles from vibe documents
- Correct published URLs
- Accurate creation timestamps
- Screenshots with CID deduplication

### Performance Improvements

- Single data collection pass
- Bulk write operations
- Eliminated redundant screenshot sync
- Reduced database operations

### Independence from IndexedDB

- Catalog becomes complete standalone data source
- My vibes page can work with only catalog database
- Remote catalog sync will display properly
- No fallback to IndexedDB needed

## Implementation Steps

1. **Update catalog sync in `useCatalog.ts`**:
   - Modify the main sync loop to collect vibe documents
   - Add screenshot collection to the same loop
   - Compose complete catalog documents
   - Replace separate operations with single bulk write

2. **Remove redundant screenshot sync**:
   - Delete the separate screenshot sync loop
   - Remove the now-unnecessary CID checking logic

3. **Test catalog completeness**:
   - Verify titles appear in catalog
   - Confirm screenshots are included
   - Check that my vibes page shows catalog data

4. **Remove IndexedDB fallback**:
   - Update `mine.tsx` to use only catalog data
   - Remove `useVibes()` dependency from display logic

## Migration Considerations

### Backward Compatibility

- Existing catalog documents will be updated with proper data
- No breaking changes to API interfaces
- Graceful handling of missing vibe documents

### Performance Impact

- Initial sync will be slower (more database queries)
- Subsequent syncs will be faster (complete data, fewer operations)
- Overall improvement in my vibes page load time

### Error Handling

- Handle missing vibe documents gracefully
- Continue processing if individual session queries fail
- Maintain catalog consistency even with partial failures

## Success Criteria

1. **Data Completeness**: Catalog vibes show proper titles and metadata
2. **Screenshot Integration**: Screenshots appear in catalog with CID tracking
3. **Performance**: Efficient bulk operations with chunking
4. **Independence**: My vibes page works without IndexedDB fallback
5. **Remote Sync**: Catalog database alone provides complete vibe listing
