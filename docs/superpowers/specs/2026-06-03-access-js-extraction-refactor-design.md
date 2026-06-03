# access.js Extraction Refactor

**Issue:** #2188 — the 250-line inline access.js extraction block in `ensure-app-slug-item.ts` (lines 156–416) is unreadable, swallows errors via `try/catch`, and violates rules-bag.

**Goal:** Extract into a focused function in its own file. Same behavior, clean structure, rules-bag compliant.

**Prerequisite:** 32 tests locked down every observable behavior (PR #2189). All green.

## Design

### New file: `vibes.diy/api/svc/intern/process-access-bindings.ts`

One function: `processAccessBindings` → `Promise<Result<void>>`

Accepts a typed options object:
- `vctx: VibesApiSQLCtx`
- `ownerHandle: string`
- `appSlug: string`
- `fullFileSystem: Array<{ vibeFileItem: VibeFile; storage: StorageResult }>`

The function handles both cases:
- **access.js present** → parse exports, upsert bindings, backfill outputs on CID change
- **access.js absent** → delete all bindings for this app

### CID model

One CID for the whole `/access.js` file. Every binding row gets the same `accessFnCid` (the file's storage CID). When any function in the file changes, the file CID changes, all bindings update, backfill runs for all affected dbs. Simple and correct — the test suite already asserts `accessFnCid === fileSystemItem.assetId`.

### What gets deleted from ensure-app-slug-item.ts

- The `JS_PROTO_NAMES` set (lines 41–54) — a fallback that `export { fn as "dbName" }` already solves. Per rules-bag: never add a fallback.
- The `extractExportSource` import (line 39) — moves to the new file
- The entire `if (accessJsEntry) { ... } else { ... }` block (lines 156–416)

### What replaces it

```ts
const rAccessBindings = await processAccessBindings(vctx, {
  ownerHandle: ensured.ownerHandle,
  appSlug: ensured.appSlug,
  fullFileSystem,
});
if (rAccessBindings.isErr()) {
  console.warn(
    `ensureAppSlugItem: access binding processing failed for ${ensured.ownerHandle}/${ensured.appSlug}:`,
    rAccessBindings.Err()
  );
}
```

### Error handling

- `processAccessBindings` wraps its body in `exception2Result` — no `try/catch`
- Returns `Result.Err` on failure
- Caller logs the error and continues — non-fatal (deliberate resilience, per CharlieHelps review)
- Push path is never blocked by extraction failures

### What moves unchanged

The backfill logic (re-invoke access function against every doc when CID changes) moves as-is into the new file. The manual stream-to-uint8array reassembly for fetching source from storage stays — it's correct, just relocated.

### What does NOT change

- `ensureApps` still stores ALL files (including access.js) in `apps.fileSystem` — this is the fix for #2188
- The `accessFunctionBindings` table schema
- The `accessFnOutputs` table schema
- The putDoc gate in `app-documents.ts` (reads from bindings, not affected)
- Channel-gated reads (reads from outputs, not affected)

## Verification

All 32 existing tests must pass unchanged after the refactor. No new tests needed — the test fortress was built for exactly this.
