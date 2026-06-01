# Backfill AccessFnOutputs on access.js Push — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `ensureAppSlugItem` creates or updates AccessFunctionBindings (access.js push), backfill AccessFnOutputs for all existing docs so channel-gated reads work immediately.

**Architecture:** Inline backfill in `ensureAppSlugItem` after the binding upsert loop. Detect CID changes, query existing docs, invoke the access function on each, upsert outputs.

**Tech Stack:** TypeScript, Drizzle ORM, @adviser/cement Result, Vitest

**Spec:** `docs/superpowers/specs/2026-06-01-backfill-access-fn-outputs-design.md`

---

### Task 1: Write integration test for backfill behavior

**Files:**
- Create: `vibes.diy/api/tests/access-fn-backfill.test.ts`

- [ ] **Step 1: Write the test file**

Create `vibes.diy/api/tests/access-fn-backfill.test.ts`:

```typescript
import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const ACCESS_JS_V1 = `export function chat(doc, oldDoc, user, ctx) {
  return { channels: ["general"], allowAnonymous: true };
}`;

const ACCESS_JS_V2 = `export function chat(doc, oldDoc, user, ctx) {
  return { channels: ["updated"], allowAnonymous: true };
}`;

interface InvokeRecorder {
  calls: { cid: string; doc: unknown; user: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}

async function setupCtx(recorder: InvokeRecorder) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, doc: params.doc, user: params.user });
      return recorder.result;
    },
  });
  const wsPair = TestWSPair.create();
  const wsEvento = vibesMsgEvento();
  const wsSendProvider = new WSSendProvider(wsPair.p2 as unknown as WebSocket);
  ctx.vibesCtx.connections.add(wsSendProvider);
  wsPair.p2.onmessage = (event: MessageEvent) => {
    wsEvento.trigger({ ctx: ctx.appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  };
  return { ctx, wsPair, sthis, deviceCA };
}

async function mkUser(
  sthis: ReturnType<typeof ensureSuperThis>,
  deviceCA: Awaited<ReturnType<typeof createTestDeviceCA>>,
  wsPair: ReturnType<typeof TestWSPair.create>,
  seqOffset: number
) {
  const user = await createTestUser({ sthis, deviceCA, seqUserId: seqOffset });
  const api = new VibesDiyApi({
    apiUrl: "http://localhost:8787/api",
    ws: wsPair.p1 as unknown as WebSocket,
    timeoutMs: 10000,
    getToken: async () => Result.Ok(await user.getDashBoardToken()),
  });
  return { user, api };
}

describe("backfill AccessFnOutputs on access.js push (#2101)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  const recorder: InvokeRecorder = {
    calls: [],
    result: { channels: ["general"], allowAnonymous: true },
  };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 800);
    ownerApi = ownerSetup.api;

    // Create app WITHOUT access.js first
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Manually seed AccessFunctionBindings so putDoc writes go through the gate
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.accessFunctionBindings).values({
      userSlug: ownerHandle,
      appSlug,
      dbName: "chat",
      accessFnCid: "pre-seed-cid",
      updated: new Date().toISOString(),
    });

    // Write docs through the access fn gate
    recorder.result = { channels: ["general"], allowAnonymous: true };
    const r1 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "msg-1" } });
    assert(r1.isOk(), "putDoc 1 failed");
    const r2 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "msg-2" } });
    assert(r2.isOk(), "putDoc 2 failed");
    const r3 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "msg-3" } });
    assert(r3.isOk(), "putDoc 3 failed");

    // Delete the pre-seed binding and outputs so we start clean for backfill tests
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFunctionBindings)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.appSlug, appSlug)
        )
      );
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFnOutputs)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.appSlug, appSlug)
        )
      );

    recorder.calls = [];
  }, 30000);

  it("backfills AccessFnOutputs when access.js is first pushed", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["general"], allowAnonymous: true };

    // Push access.js — should trigger backfill for existing docs
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V1 },
      ],
    });
    assert(r.isOk(), "ensureAppSlug with access.js failed");

    // Verify invokeAccessFn was called for each existing doc
    expect(recorder.calls.length).toBe(3);
    expect(recorder.calls.every((c) => c.user === null)).toBe(true);

    // Verify AccessFnOutputs rows were created
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));

    expect(rows.length).toBe(3);
    for (const row of rows) {
      const output = JSON.parse(row.output);
      expect(output.channels).toEqual(["general"]);
      expect(output.allowAnonymous).toBe(true);
      expect(row.hasGrants).toBe(0);
    }
  });

  it("skips backfill on idempotent re-push (same CID)", async () => {
    recorder.calls = [];

    // Re-push same access.js — CID unchanged, no backfill
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V1 },
      ],
    });
    assert(r.isOk(), "re-push failed");

    // No backfill calls — CID didn't change
    const backfillCalls = recorder.calls.filter((c) => c.user === null);
    expect(backfillCalls.length).toBe(0);
  });

  it("re-backfills on access.js update (new CID)", async () => {
    recorder.calls = [];
    recorder.result = { channels: ["updated"], allowAnonymous: true };

    // Push updated access.js — different content = new CID
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V2 },
      ],
    });
    assert(r.isOk(), "update push failed");

    // Backfill calls for all 3 docs
    const backfillCalls = recorder.calls.filter((c) => c.user === null);
    expect(backfillCalls.length).toBe(3);

    // Verify outputs updated with new CID's fnCid
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));

    expect(rows.length).toBe(3);
    for (const row of rows) {
      const output = JSON.parse(row.output);
      expect(output.channels).toEqual(["updated"]);
    }
  });

  it("skips docs where access fn returns forbidden", async () => {
    // Delete all outputs and bindings to start fresh
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFnOutputs)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.appSlug, appSlug)
        )
      );
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFunctionBindings)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFunctionBindings.appSlug, appSlug)
        )
      );

    recorder.calls = [];
    let callCount = 0;
    // Make the mock return forbidden for the second doc
    const origResult = recorder.result;
    const testCtx = appCtx;
    testCtx.vibesCtx.invokeAccessFn = async (params) => {
      callCount++;
      recorder.calls.push({ cid: params.cid, doc: params.doc, user: params.user });
      if (callCount === 2) return { forbidden: "denied" };
      return { channels: ["general"], allowAnonymous: true };
    };

    const ACCESS_JS_V3 = `export function chat(doc, oldDoc, user, ctx) {
      return { channels: ["v3"], allowAnonymous: true };
    }`;

    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: "function App() { return null; } App();" },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_V3 },
      ],
    });
    assert(r.isOk(), "push failed");

    // All 3 docs invoked, but only 2 should have outputs (one was forbidden)
    expect(recorder.calls.length).toBe(3);

    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const rows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));

    expect(rows.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run vibes.diy/api/tests/access-fn-backfill.test.ts
```

Expected: FAIL — backfill logic doesn't exist yet.

- [ ] **Step 3: Commit the test**

```bash
npx prettier --write vibes.diy/api/tests/access-fn-backfill.test.ts
git add vibes.diy/api/tests/access-fn-backfill.test.ts
git commit -m "test(firefly): integration tests for AccessFnOutputs backfill on access.js push

Covers: first push backfills existing docs, idempotent re-push skips,
CID change re-backfills, forbidden docs skipped. Issue #2101."
```

---

### Task 2: Implement backfill logic in ensureAppSlugItem

**Files:**
- Modify: `vibes.diy/api/svc/public/ensure-app-slug-item.ts`

- [ ] **Step 1: Add `exception2Result` to imports**

In `vibes.diy/api/svc/public/ensure-app-slug-item.ts`, add `exception2Result` to the `@adviser/cement` import and add `sql` and `desc` from `drizzle-orm`.

At the top, add `exception2Result` to the cement import:
```typescript
import {
  EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult,
  uint8array2stream, to_uint8, exception2Result,
} from "@adviser/cement";
```

Add `desc` and `sql` to the drizzle-orm import:
```typescript
import { and, eq, notInArray, desc, sql } from "drizzle-orm";
```

- [ ] **Step 2: Query existing bindings before the upsert loop**

Inside the `if (accessJsEntry)` block, after `const exportNames: string[] = [];` is populated and before the `if (exportNames.length > 0)` block, query existing bindings to detect CID changes:

```typescript
        // Snapshot existing CIDs before upsert to detect changes for backfill
        const existingBindings = await vctx.sql.db
          .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
          .from(tAfb)
          .where(and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug)));
        const oldCids = new Map(existingBindings.map((b) => [b.dbName, b.accessFnCid]));
```

- [ ] **Step 3: Add backfill after the binding upsert loop**

After the upsert loop (the `for (const dbName of exportNames)` block) and after the stale-row deletion, add the backfill logic:

```typescript
          // Backfill AccessFnOutputs for dbNames where the CID changed or is new (#2101)
          if (vctx.invokeAccessFn) {
            const changedDbNames = exportNames.filter((name) => oldCids.get(name) !== cid);
            if (changedDbNames.length > 0) {
              // Fetch source once (same CID for all exports from this access.js)
              let accessFnSource: string | undefined;
              if (accessJsEntry.storage.getURL) {
                const rFetch = await vctx.storage.fetch(accessJsEntry.storage.getURL);
                if (rFetch.type === "fetch.ok") {
                  const reader = rFetch.data.getReader();
                  const chunks: Uint8Array[] = [];
                  for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value) chunks.push(value);
                  }
                  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
                  const merged = new Uint8Array(totalLength);
                  let offset = 0;
                  for (const chunk of chunks) {
                    merged.set(chunk, offset);
                    offset += chunk.length;
                  }
                  accessFnSource = new TextDecoder().decode(merged);
                }
              }
              // Fallback: use in-memory source if storage fetch failed
              if (!accessFnSource) {
                accessFnSource = accessJsSource;
              }

              if (accessFnSource) {
                const tDocs = vctx.sql.tables.appDocuments;
                const tOutputs = vctx.sql.tables.accessFnOutputs;

                for (const dbName of changedDbNames) {
                  const allRows = await vctx.sql.db
                    .select({ docId: tDocs.docId, data: tDocs.data, deleted: tDocs.deleted })
                    .from(tDocs)
                    .where(
                      and(eq(tDocs.ownerHandle, ensured.ownerHandle), eq(tDocs.appSlug, ensured.appSlug), eq(tDocs.dbName, dbName))
                    )
                    .orderBy(sql`${tDocs.docId}, ${tDocs.seq}`);

                  // Dedup: last row per docId wins (highest seq)
                  const latest = new Map<string, (typeof allRows)[0]>();
                  for (const row of allRows) {
                    latest.set(row.docId, row);
                  }

                  for (const [docId, row] of latest) {
                    if (row.deleted === 1) continue;

                    const rInvoke = await exception2Result(() =>
                      vctx.invokeAccessFn!({
                        cid,
                        doc: row.data,
                        oldDoc: null,
                        user: null,
                        source: accessFnSource,
                        grantState: { members: {}, roleGrants: {}, userGrants: {} },
                      })
                    );

                    if (rInvoke.isErr()) {
                      console.warn(`backfill: access fn threw for ${ensured.ownerHandle}/${ensured.appSlug}/${dbName}/${docId}:`, rInvoke.Err());
                      continue;
                    }

                    const invokeResult = rInvoke.Ok();
                    if ("forbidden" in invokeResult) continue;

                    const outputHasGrants =
                      (invokeResult.members && Object.keys(invokeResult.members).length > 0) ||
                      (invokeResult.grant?.users && Object.keys(invokeResult.grant.users).length > 0) ||
                      (invokeResult.grant?.roles && Object.keys(invokeResult.grant.roles).length > 0) ||
                      (invokeResult.grant?.public && invokeResult.grant.public.length > 0)
                        ? 1
                        : 0;

                    const rUpsert = await exception2Result(() =>
                      vctx.sql.db
                        .insert(tOutputs)
                        .values({
                          userSlug: ensured.ownerHandle,
                          appSlug: ensured.appSlug,
                          dbName,
                          docId,
                          fnCid: cid,
                          output: JSON.stringify(invokeResult),
                          hasGrants: outputHasGrants,
                        })
                        .onConflictDoUpdate({
                          target: [tOutputs.userSlug, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
                          set: {
                            fnCid: cid,
                            output: JSON.stringify(invokeResult),
                            hasGrants: outputHasGrants,
                          },
                        })
                    );
                    if (rUpsert.isErr()) {
                      console.warn(`backfill: output upsert failed for ${ensured.ownerHandle}/${ensured.appSlug}/${dbName}/${docId}:`, rUpsert.Err());
                    }
                  }
                }
              }
            }
          }
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run vibes.diy/api/tests/access-fn-backfill.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Run fast-check, prettier, commit**

```bash
npx prettier --write vibes.diy/api/svc/public/ensure-app-slug-item.ts
pnpm fast-check
git add vibes.diy/api/svc/public/ensure-app-slug-item.ts
git commit -m "feat(firefly): backfill AccessFnOutputs on access.js push

When ensureAppSlugItem creates or updates AccessFunctionBindings
(new CID), invoke the access function on all existing docs and
store the results. Ensures channel-gated reads work immediately
after pushing access.js — no race window.

Skips backfill on idempotent re-push (same CID) and skips docs
where the access fn returns forbidden.

Closes #2101"
```
