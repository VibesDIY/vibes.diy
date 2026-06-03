# access.js fileSystem Test Coverage

**Issue:** #2188 — access.js should be in `apps.fileSystem` (servable by sandbox, pullable by CLI), not only in `accessFunctionBindings`.

**Goal:** Lock down every observable behavior of the access.js extraction logic so the 250-line inline block in `ensure-app-slug-item.ts` (lines 156–416) can be refactored stress-free.

## Current State

The extraction logic in `ensure-app-slug-item.ts` does three things inline after `ensureApps` returns:

1. **Parse exports** — regex scan of access.js source for named exports and default export
2. **Upsert bindings** — one `accessFunctionBindings` row per export, delete stale rows
3. **Backfill outputs** — re-invoke the access function against every document when CID changes

All three are wrapped in a `try/catch` that swallows errors into `console.warn` — a rules-bag violation (`exception2Result`, never `try/catch`). Per CharlieHelps review (#2189): the swallow was **deliberate resilience** (don't block the push path on parsing failures), dating back to the initial integration commit. The refactor should preserve this behavior: report the failure via `Result`, but don't fail the push.

### Existing test coverage

| File | Tests | Seeds bindings via |
|---|---|---|
| `access-fn-backfill.test.ts` | Backfill on push, idempotent skip, CID change, forbidden skip | `ensureAppSlug` (front door) |
| `access-fn-invoke.test.ts` | putDoc gate, forbidden, doc._id, grant propagation | Manual DB insert |
| `access-fn-channel-read.test.ts` | Channel filtering, no-binding fallback | Manual DB insert |
| `resolve-code-blocks.test.ts` | VibeFile production for access.js | N/A (unit test) |

### Gaps

- No test verifies access.js lands in `apps.fileSystem`
- No test verifies sandbox serves `/access.js?source=true`
- No test verifies binding CID matches fileSystem asset CID (single source of truth)
- No test verifies access.js carries forward across turns via version timeline seed
- Invoke and channel-read tests bypass extraction entirely via manual DB seeding

## Design

### Principles

- **Unit tests** — pure functions, no DB, no DI
- **Integration tests** — push through `ensureAppSlug`, let extraction run, assert outcomes. No manual DB seeding for the write side.
- **No mocking** — use the existing `invokeAccessFn` DI pattern via `createVibeDiyTestCtx`
- **Rules-bag compliant** — TS, no `any`, `exception2Result` not `try/catch`, no `export default`

### New file: `access-fn-filesystem.test.ts`

One integration test file. Shared setup: `createVibeDiyTestCtx` + one user + one app slug. Tests are ordered to build on shared state where it makes sense.

#### Test 1: access.js lands in apps.fileSystem after push

Push `[App.jsx, access.js]` via `ensureAppSlug`. Query `apps` table. Assert `fileSystem` JSON column contains an entry with `fileName: "/access.js"`.

#### Test 2: sandbox serves /access.js?source=true

Using the fsId from test 1, hit `serv-entry-point` with `/access.js?source=true`. Assert HTTP 200 with the original access.js source content.

#### Test 3: access.js carries forward in version timeline

Simulate a two-turn flow:
- Turn 1: push App.jsx + access.js → get fsId1
- Turn 2: call `loadVersionTimeline`, get seed, call `resolveCodeBlocksToFileSystem` with only an App.jsx edit block + seed
- Assert the resolved VibeFile array includes `/access.js` carried forward from seed

#### Test 4: binding rows created via front door

Push access.js with `export function chat(...)` + `export default function(...)`. Assert `accessFunctionBindings` has rows for `dbName: "chat"` and `dbName: "*"`. No manual DB seeding — the extraction logic must create them.

#### Test 5: binding CID matches fileSystem CID

After test 4's push, read the `/access.js` FileSystemItem from `apps.fileSystem`. Read the binding rows. Assert `accessFnCid === fileSystemItem.assetId` for every binding row.

#### Test 6: stale bindings cleaned up

Push access.js with `export function chat` + `export function boards`. Re-push with only `export function chat`. Assert the `boards` row is gone, `chat` row remains.

#### Test 7: all bindings deleted when access.js removed

Push App.jsx + access.js. Re-push with only App.jsx. Assert zero `accessFunctionBindings` rows for this app.

#### Test 8: backfill runs through front door

Push App.jsx without access.js. Write 2 docs via `putDoc` (manually seed one binding to get through the gate). Then push App.jsx + access.js via `ensureAppSlug`. Assert `accessFnOutputs` rows exist for both docs — created by the extraction logic's backfill, not by manual seeding.

### Fix existing tests: replace manual DB seeding with extraction-based setup

Two existing test files bypass the extraction logic by manually inserting rows into `accessFunctionBindings`. These tests are correct about what they test (putDoc gate, channel filtering) but wrong about how they set up state. Fix them so the extraction logic is exercised on every run.

#### `access-fn-invoke.test.ts`

**Current:** `seedBinding()` helper (line 63–74) does a raw `db.insert` into `accessFunctionBindings` with a hardcoded CID. The app is created via `ensureAppSlug` with only App.jsx — no access.js.

**Fix:** Change `beforeAll` to push `[App.jsx, access.js]` via `ensureAppSlug`. The access.js source exports a `default` function (matching dbName `"*"` wildcard). Remove `seedBinding()` entirely. The binding rows come from the extraction logic. Update `CID` references to read from the actual binding rows rather than a hardcoded constant.

#### `access-fn-channel-read.test.ts`

**Current:** `beforeAll` (line 61–123) creates the app with only App.jsx, then manually inserts a binding row for `dbName: "chat"` with a hardcoded CID.

**Fix:** Push `[App.jsx, access.js]` where access.js has `export function chat(doc, oldDoc, user) { ... }`. The extraction logic creates the `chat` binding row. Remove the manual insert. Update CID references to read from actual binding rows.

Both fixes are mechanical: replace the manual insert with an access.js file in the push, remove the hardcoded CID, read actual CIDs from the binding table after push. The test assertions themselves don't change — they still test the putDoc gate and channel filtering. They just stop lying about how bindings get created.

Per CharlieHelps review (#2189): the manual seeding predates the extraction logic (`access-fn-invoke` seeding at `8798d8a4` predates named-export extraction at `0400ad89`; `access-fn-channel-read` used direct seeding as a test shortcut). No other runtime writers of `accessFunctionBindings` exist outside `ensure-app-slug-item.ts` — the only other writes are in these test files.

### Pure function coverage

`extractExportSource` in `access-function.ts` is already a pure function and could get its own unit tests, but the integration tests exercise it end-to-end. Unit tests for it can come during the refactor.

## What this enables

Once these tests pass on the current code, the refactor can:

1. Extract the 250-line inline block into its own function (or module)
2. Replace the `try/catch` with `exception2Result` — but preserve the non-fatal behavior (extraction failure must not block the push, per CharlieHelps review)
3. Ensure access.js is always in `fileSystem` (fixing #2188)
4. Make the backfill async (not blocking the push response) if desired

Every behavioral change will be caught by test failures — no guessing.
