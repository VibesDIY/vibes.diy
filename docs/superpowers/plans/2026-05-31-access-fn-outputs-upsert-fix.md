# AccessFnOutputs Upsert Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the AccessFnOutputs upsert in `putDocEvento` so it doesn't crash the handler on failure (#2095), and add test coverage proving output rows are written (#2095 verification).

**Architecture:** Wrap the existing `insert...onConflictDoUpdate` call with `exception2Result()` from `@adviser/cement` (rules-bag: never use try/catch). Log on failure, continue to `res-put-doc` response. Add integration test asserting rows land in the `accessFnOutputs` table.

**Tech Stack:** TypeScript, Drizzle ORM, @adviser/cement Result, Vitest

**Spec:** `docs/superpowers/specs/2026-05-31-access-fn-outputs-upsert-fix-design.md`

---

### Task 1: Add test for AccessFnOutputs row storage

**Files:**

- Modify: `vibes.diy/api/tests/access-fn-invoke.test.ts`

The test must verify that after a successful write through the access fn gate, a row appears in the `accessFnOutputs` table with correct values.

- [ ] **Step 1: Write the failing test**

Add a new `it()` block after the existing two tests inside the `describe("invokeAccessFn gate ...")` block in `vibes.diy/api/tests/access-fn-invoke.test.ts`. Import `eq` and `and` from `drizzle-orm` at the top of the file:

```typescript
// Add to imports at top of file:
import { eq, and } from "drizzle-orm";
```

Add the test after the "write rejected" test:

```typescript
it("stores AccessFnOutputs row after successful access fn evaluation", async () => {
  recorder.calls = [];
  recorder.result = { channels: ["public"], allowAnonymous: true };
  const res = await ownerApi.putDoc({
    ownerHandle,
    appSlug,
    dbName: "default",
    doc: { title: "output storage test" },
  });
  expect(res.isOk()).toBe(true);
  const putRes = res.Ok();
  expect(putRes.status).toBe("ok");

  // Query the accessFnOutputs table for the row
  const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
  const rows = await appCtx.vibesCtx.sql.db
    .select()
    .from(tOutputs)
    .where(
      and(
        eq(tOutputs.userHandle, ownerHandle),
        eq(tOutputs.appSlug, appSlug),
        eq(tOutputs.dbName, "default"),
        eq(tOutputs.docId, putRes.id)
      )
    );

  expect(rows.length).toBe(1);
  const row = rows[0];
  expect(row?.fnCid).toBe(CID);
  expect(row?.hasGrants).toBe(0);
  const output = JSON.parse(row?.output ?? "{}");
  expect(output.channels).toEqual(["public"]);
  expect(output.allowAnonymous).toBe(true);
});
```

Note: `putRes.id` is the doc ID returned by `res-put-doc`. The `ResPutDoc` type includes `id: string`. The `status` field is `"ok"`.

- [ ] **Step 2: Run test to verify it fails**

Run from the repo root:

```bash
cd vibes.diy/api/tests && pnpm test -- access-fn-invoke.test.ts
```

Expected: The new test should FAIL — on `origin/main` the upsert has no error handling, so if the table works it may pass, but if the upsert throws (the bug), the `putDoc` call itself will timeout or error. Either way, this test establishes the contract.

- [ ] **Step 3: Commit the test**

```bash
git add vibes.diy/api/tests/access-fn-invoke.test.ts
git commit -m "test(firefly): add AccessFnOutputs row storage assertion

Verifies that putDocEvento stores the access function output in the
accessFnOutputs table after a successful write through the gate.
Covers issue #2095."
```

---

### Task 2: Wrap the upsert with exception2Result

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents.ts`

- [ ] **Step 1: Add `exception2Result` to the cement import**

In `vibes.diy/api/svc/public/app-documents.ts`, the first line is:

```typescript
import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
```

Change to:

```typescript
import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
```

- [ ] **Step 2: Wrap the upsert block**

Find the block (around line 439–469 on origin/main):

```typescript
// Store access fn output for future reduce queries
if (accessResult && !("forbidden" in accessResult) && afbRow?.accessFnCid) {
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const outputHasGrants =
    (accessResult.members && Object.keys(accessResult.members).length > 0) ||
    (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
    (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
    (accessResult.grant?.public && accessResult.grant.public.length > 0)
      ? 1
      : 0;

  await vctx.sql.db
    .insert(tOutputs)
    .values({
      userHandle: req.ownerHandle,
      appSlug: req.appSlug,
      dbName: req.dbName,
      docId,
      fnCid: afbRow.accessFnCid,
      output: JSON.stringify(accessResult),
      hasGrants: outputHasGrants,
    })
    .onConflictDoUpdate({
      target: [tOutputs.userHandle, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
      set: {
        fnCid: afbRow.accessFnCid,
        output: JSON.stringify(accessResult),
        hasGrants: outputHasGrants,
      },
    });
}
```

Replace with:

```typescript
// Store access fn output for future reduce queries
if (accessResult && !("forbidden" in accessResult) && afbRow?.accessFnCid) {
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const outputHasGrants =
    (accessResult.members && Object.keys(accessResult.members).length > 0) ||
    (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
    (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
    (accessResult.grant?.public && accessResult.grant.public.length > 0)
      ? 1
      : 0;

  const rUpsert = await exception2Result(async () =>
    vctx.sql.db
      .insert(tOutputs)
      .values({
        userHandle: req.ownerHandle,
        appSlug: req.appSlug,
        dbName: req.dbName,
        docId,
        fnCid: afbRow.accessFnCid,
        output: JSON.stringify(accessResult),
        hasGrants: outputHasGrants,
      })
      .onConflictDoUpdate({
        target: [tOutputs.userHandle, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
        set: {
          fnCid: afbRow.accessFnCid,
          output: JSON.stringify(accessResult),
          hasGrants: outputHasGrants,
        },
      })
  );
  if (rUpsert.isErr()) {
    console.error("AccessFnOutputs upsert failed:", rUpsert.Err());
  }
}
```

Key changes:

- The `await vctx.sql.db.insert(...)` is now wrapped inside `exception2Result(async () => ...)`
- If the upsert throws, `rUpsert.isErr()` is true — log the error but do NOT re-throw
- The `res-put-doc` response below always sends regardless of upsert outcome

- [ ] **Step 3: Run tests to verify everything passes**

```bash
cd vibes.diy/api/tests && pnpm test -- access-fn-invoke.test.ts
```

Expected: All three tests PASS (the new output storage test + existing two).

- [ ] **Step 4: Run pnpm fast-check**

```bash
pnpm fast-check
```

Expected: All checks pass (format, build, lint, tests).

- [ ] **Step 5: Run prettier on changed files**

```bash
npx prettier --write vibes.diy/api/svc/public/app-documents.ts vibes.diy/api/tests/access-fn-invoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents.ts vibes.diy/api/tests/access-fn-invoke.test.ts
git commit -m "fix(firefly): wrap AccessFnOutputs upsert with exception2Result

The upsert had no error handling — if it threw (schema mismatch,
column error), it crashed the entire putDocEvento handler, preventing
the res-put-doc response from sending (client timeout, #2094) and
leaving no rows in AccessFnOutputs (#2095). Now logs the error and
continues to send the response.

Fixes #2095"
```
