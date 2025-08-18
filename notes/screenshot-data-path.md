# Screenshot Data Path Challenge

## Overview

The VibeCardCatalog component is not displaying screenshots even though they should exist in the individual vibe databases. The catalog system is failing to copy screenshots from individual vibe databases (`vibe-${vibeId}`) to the centralized catalog database (`vibez-catalog-${userId}`).

## Current Architecture

### Screenshot Storage Flow (Working)

```
ResultPreview → postMessage → useSimpleChat.addScreenshot() → useSession.addScreenshot()
└── Stores in vibe-${vibeId} database as:
    {
      type: 'screenshot',
      session_id: vibeId,
      cid: 'generated-content-id',
      _files: {
        screenshot: File
      }
    }
```

### Screenshot Catalog Flow (Broken)

```
useCatalog → getLatestScreenshot(vibeId) → query vibe-${vibeId} for type='screenshot'
└── Should find screenshots and copy to catalog database
    └── Currently returning: hasSessionScreenshot: false
```

## Problem Symptoms

From debugging logs:

```
🐛 Screenshot check for fmecy5cvb3o5nlqhfp: {
  hasVibeDoc: true,
  hasSessionScreenshot: false,  ← ❌ This is the issue!
  sessionScreenshotCid: undefined,
  sessionScreenshotFiles: null,
  catalogCurrentCid: undefined
}
```

**All vibes show `hasSessionScreenshot: false`** despite screenshots existing in individual databases.

## Root Cause Investigation

### 1. Screenshot Write Path (useSession.ts)

```typescript
const addScreenshot = useCallback(
  async (screenshotData: string | null) => {
    if (!sessionId || !screenshotData) return;
    const screenshot = {
      type: 'screenshot', // ✅ Uses 'screenshot' type
      session_id: sessionId, // ✅ Links to session
      cid, // ✅ Content ID for deduplication
      _files: {
        screenshot: file, // ✅ File attachment
      },
    };
    await sessionDatabase.put(screenshot); // ✅ Stores in vibe-${sessionId}
  },
  [sessionId, sessionDatabase]
);
```

### 2. Screenshot Read Path (useCatalog.ts)

```typescript
async function getLatestScreenshot(vibeId: string): Promise<ScreenshotDocument | null> {
  const sessionDb = fireproof(`vibe-${vibeId}`); // ✅ Correct database
  const sessionResult = await sessionDb.query('type', {
    key: 'screenshot', // ✅ Correct query key
    includeDocs: true,
    descending: true,
    limit: 1,
  });

  // ❌ This query is returning 0 results
  if (sessionResult.rows.length > 0) {
    const screenshot = sessionResult.rows[0].doc as ScreenshotDocument;
    if (screenshot._files?.screenshot && screenshot.cid) {
      return screenshot;
    }
  }
  return null;
}
```

## Debugging Plan

### Phase 1: Detailed Query Logging

Added comprehensive logging to `getLatestScreenshot()` and `getVibeDocument()` to reveal:

- Database name being queried
- Query results count and structure
- Document types and file attachments found
- CID and file structure validation

### Phase 2: Data Structure Validation

Verify that:

1. Screenshots are actually being stored in individual vibe databases
2. The `type: 'screenshot'` documents exist with proper structure
3. The query index is working correctly
4. File attachments are preserved

### Phase 3: Index Investigation

Check if:

- The `type` index exists in individual vibe databases
- Documents are properly indexed for the query
- Database versioning/migration issues

## Expected Findings

The logging should reveal one of these issues:

1. **No screenshots exist**: Screenshots aren't being saved to individual databases
2. **Wrong structure**: Screenshots exist but with different document structure
3. **Index missing**: Query not finding existing documents due to missing index
4. **Database access**: Cannot access individual vibe databases properly

## Success Criteria

Once fixed, we should see:

- `hasSessionScreenshot: true` in catalog debug logs
- Screenshots appearing in `VibeCardCatalog` components
- Bulk catalog update showing `X with screenshots` instead of `0 with screenshots`

## Related Files

- `/app/hooks/useSession.ts` - Screenshot storage (`addScreenshot`)
- `/app/hooks/useCatalog.ts` - Screenshot reading (`getLatestScreenshot`)
- `/app/components/VibeCardCatalog.tsx` - Screenshot display
- `/app/components/ResultPreview/ResultPreview.tsx` - Screenshot capture trigger
