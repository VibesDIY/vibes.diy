# fix(firefly): AccessFnOutputs upsert error handling — Design

**Issue:** #2095 (also fixes #2094)
**Date:** 2026-05-31

## Problem

The `AccessFnOutputs` upsert at the end of `putDocEvento` in `app-documents.ts` has no try/catch. When the upsert throws (likely schema mismatch from Drizzle push), two things break:

1. **No rows stored** (#2095) — grant reduce is always empty, so `requireAccess`/`requireRole` always fail
2. **No response sent** (#2094) — `res-put-doc` never fires, client sees 30s timeout

The doc insert succeeds. The access fn evaluates correctly. Only the output storage crashes the handler.

## Fix

### 1. Wrap the upsert with exception2Result

In `app-documents.ts`, the block starting at `if (accessResult && !("forbidden" in accessResult) && afbRow?.accessFnCid)`:

- Wrap the `vctx.sql.db.insert(tOutputs)...onConflictDoUpdate(...)` call with `exception2Result()` from `@adviser/cement` (per rules-bag: never use try/catch)
- Check `rUpsert.isErr()` and `console.error("AccessFnOutputs upsert failed:", rUpsert.Err())` on failure
- Do NOT propagate the error — the doc write already succeeded, output storage is non-critical for the immediate response
- The `res-put-doc` response always sends regardless of upsert outcome

### 2. Add test coverage

In `access-fn-invoke.test.ts`, add a test that:

- Performs a write through the access fn gate (using the existing mock invoker)
- Queries the `accessFnOutputs` table afterward
- Asserts a row was inserted with correct `userHandle`, `appSlug`, `dbName`, `docId`, `fnCid`, `output`, and `hasGrants`

## Out of Scope

- Investigating the underlying schema mismatch (the try/catch will surface the actual error in wrangler tail)
- Broader error handling refactors of the access fn gate
- Transactional doc + output writes
