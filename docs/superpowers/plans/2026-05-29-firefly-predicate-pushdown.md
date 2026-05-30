# Firefly Predicate Pushdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push string-field + key/keys/range query hints from `useLiveQuery` to the server so only matching docs travel the wire, instead of sending all docs and filtering on the client.

**Architecture:** Add optional `filter` to `ReqQueryDocs`; extract a pure `applyQueryFilter` function in the server handler and call it after the existing JS dedup step; thread the hint through `FireflyTransport.queryDocs` → `VibeSandboxApi` (postMessage) → `FireflyApiAdapter` (WebSocket); detect the hint-eligible case in `FireflyDatabase.query()` (string mapFn + key/keys/range opts). Client-side filter in `FireflyDatabase.query()` stays as a correctness safety net.

**Tech Stack:** TypeScript, arktype v2, Drizzle ORM, vitest

---

## File Map

| File | Change |
|------|--------|
| `vibes.diy/api/types/app-documents.ts` | Add `queryFilter` arktype schema + `QueryFilter` type; add `"filter?"` to `reqQueryDocs` |
| `vibes.diy/vibe/types/index.ts` | Import `queryFilter` from api-types; add `"filter?"` to `ReqQueryDocs`; re-export `type QueryFilter` |
| `vibes.diy/api/svc/public/app-documents.ts` | Export `applyQueryFilter` pure function; call it in `queryDocsEvento` after dedup |
| `vibes.diy/vibe/runtime/firefly-database.ts` | Add `filter?` param to `FireflyTransport.queryDocs`; build hint in `FireflyDatabase.query()` |
| `vibes.diy/vibe/runtime/register-dependencies.ts` | Thread `filter` through `VibeSandboxApi.queryDocs` |
| `vibes.diy/api/impl/firefly-api-adapter.ts` | Thread `filter` through `FireflyApiAdapter.queryDocs` |
| `vibes.diy/api/tests/query-filter.test.ts` | **New** — pure unit tests for `applyQueryFilter` |
| `vibes.diy/api/tests/app-documents.test.ts` | Add integration tests for filtered `queryDocs` via full API path |
| `vibes.diy/api/impl/firefly-api-adapter.test.ts` | Add test that filter is threaded through to `VibesDiyApi.queryDocs` |

---

## Task 1: Add QueryFilter type to api-types and vibe-types

**Files:**
- Modify: `vibes.diy/api/types/app-documents.ts`
- Modify: `vibes.diy/vibe/types/index.ts`

- [ ] **Step 1: Add QueryFilter schema to api/types/app-documents.ts**

Open `vibes.diy/api/types/app-documents.ts`. After the existing imports and before the `// ── queryDocs` comment, there are no changes needed to imports. Find the `reqQueryDocs` definition at line 68 and replace the block through line 78:

```ts
// ── queryDocs ───────────────────────────────────────────────────────

export const queryFilter = type({
  field: "string",
  "key?": "unknown",
  "keys?": type("unknown").array(),
  "range?": type(["unknown", "unknown"]),
});
export type QueryFilter = typeof queryFilter.infer;

export const reqQueryDocs = type({
  type: "'vibes.diy.req-query-docs'",
  "auth?": dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  "filter?": queryFilter,
});
export type ReqQueryDocs = typeof reqQueryDocs.infer;
export function isReqQueryDocs(obj: unknown): obj is ReqQueryDocs {
  return !(reqQueryDocs(obj) instanceof type.errors);
}
```

- [ ] **Step 2: Update vibe/types/index.ts to thread filter through postMessage boundary**

In `vibes.diy/vibe/types/index.ts`, line 1 currently reads:
```ts
import { FPCloudClaim, dbAcl } from "@vibes.diy/api-types";
```

Change it to:
```ts
import { FPCloudClaim, dbAcl, queryFilter } from "@vibes.diy/api-types";
```

Then in the `export { ... } from "@vibes.diy/api-types"` block (around line 345), add `type QueryFilter` to the list:
```ts
export {
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type ResListDbNames,
  type EvtDocChanged,
  type QueryFilter,
  isResPutDoc,
  isResGetDoc,
  isResGetDocNotFound,
  isResQueryDocs,
  isResDeleteDoc,
  isResSubscribeDocs,
  isResListDbNames,
  isEvtDocChanged,
} from "@vibes.diy/api-types";
```

Then find `ReqQueryDocs` (around line 396) and add `"filter?"`:
```ts
export const ReqQueryDocs = type({
  type: "'vibes.diy.req-query-docs'",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  "filter?": queryFilter,
}).and(Base);

export type ReqQueryDocs = typeof ReqQueryDocs.infer;

export function isReqQueryDocs(x: unknown): x is ReqQueryDocs {
  return !(ReqQueryDocs(x) instanceof type.errors);
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /path/to/vibes.diy && pnpm build 2>&1 | head -40
```

Expected: build succeeds (or only pre-existing errors). No new TS errors from the added types.

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/types/app-documents.ts vibes.diy/vibe/types/index.ts
git commit -m "feat(firefly): add QueryFilter type to ReqQueryDocs wire boundary"
```

---

## Task 2: Write failing unit tests for applyQueryFilter

**Files:**
- Create: `vibes.diy/api/tests/query-filter.test.ts`

- [ ] **Step 1: Create the test file**

Create `vibes.diy/api/tests/query-filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyQueryFilter } from "../svc/public/app-documents.js";

type Doc = { _id: string } & Record<string, unknown>;

const docs: Doc[] = [
  { _id: "1", status: "active", count: 3 },
  { _id: "2", status: "inactive", count: 7 },
  { _id: "3", status: "active", count: 1 },
  { _id: "4", status: "pending", count: 5 },
];

describe("applyQueryFilter", () => {
  it("returns all docs when filter is undefined", () => {
    expect(applyQueryFilter(docs, undefined)).toHaveLength(4);
  });

  it("key: returns only docs where field equals value", () => {
    const result = applyQueryFilter(docs, { field: "status", key: "active" });
    expect(result).toHaveLength(2);
    expect(result.map((d) => d._id).sort()).toEqual(["1", "3"]);
  });

  it("key: returns empty when no doc matches", () => {
    const result = applyQueryFilter(docs, { field: "status", key: "archived" });
    expect(result).toHaveLength(0);
  });

  it("keys: returns docs where field is in the set", () => {
    const result = applyQueryFilter(docs, { field: "status", keys: ["active", "pending"] });
    expect(result.map((d) => d._id).sort()).toEqual(["1", "3", "4"]);
  });

  it("range: returns docs where field value is within [lo, hi] inclusive", () => {
    const result = applyQueryFilter(docs, { field: "count", range: [3, 6] });
    expect(result.map((d) => d._id).sort()).toEqual(["1", "4"]);
  });

  it("range: string range uses lexicographic comparison", () => {
    const result = applyQueryFilter(docs, { field: "status", range: ["active", "inactive"] });
    expect(result.map((d) => d._id).sort()).toEqual(["1", "2", "3"]);
  });

  it("excludes docs where the field is missing", () => {
    const withMissing: Doc[] = [{ _id: "5" }, ...docs];
    const result = applyQueryFilter(withMissing, { field: "status", key: "active" });
    expect(result.find((d) => d._id === "5")).toBeUndefined();
  });

  it("dedup correctness: operates on already-deduped docs (latest revision value visible)", () => {
    // Simulate caller passing the post-dedup doc with the latest value.
    // applyQueryFilter has no revision concept — it sees what it's given.
    const postDedup: Doc[] = [{ _id: "doc-1", status: "active" }];
    const result = applyQueryFilter(postDedup, { field: "status", key: "active" });
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("doc-1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test query-filter
```

Expected: FAIL — `applyQueryFilter` is not exported from `app-documents.ts` yet.

---

## Task 3: Implement applyQueryFilter and apply in handler

**Files:**
- Modify: `vibes.diy/api/svc/public/app-documents.ts`

- [ ] **Step 1: Add import for QueryFilter**

At the top of `vibes.diy/api/svc/public/app-documents.ts`, find the existing import from `@vibes.diy/api-types` and add `QueryFilter` and `queryFilter` is already imported via `reqQueryDocs` — but `QueryFilter` is a type. Check the existing import and add:

```ts
import type { QueryFilter } from "@vibes.diy/api-types";
```

(or add `type QueryFilter` to the existing `@vibes.diy/api-types` import if one exists).

- [ ] **Step 2: Export applyQueryFilter function**

Add this function before the `queryDocsEvento` definition (around line 288):

```ts
export function applyQueryFilter(
  docs: ({ _id: string } & Record<string, unknown>)[],
  filter: QueryFilter | undefined,
): ({ _id: string } & Record<string, unknown>)[] {
  if (!filter) return docs;
  const { field, key, keys, range } = filter;
  if (key !== undefined) {
    return docs.filter((doc) => doc[field] === key);
  }
  if (keys !== undefined) {
    const keySet = new Set(keys);
    return docs.filter((doc) => keySet.has(doc[field]));
  }
  if (range !== undefined) {
    const [lo, hi] = range;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return docs.filter((doc) => doc[field] !== undefined && (doc[field] as any) >= lo && (doc[field] as any) <= hi);
  }
  return docs;
}
```

- [ ] **Step 3: Apply filter in queryDocsEvento handler**

Inside `queryDocsEvento.handle`, find the line that builds the `docs` array (around line 344). After the `}` that closes the `for (const row of latest.values())` loop and before the `await ctx.send.send(...)` call, add:

```ts
      const filteredDocs = applyQueryFilter(docs, req.filter);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-query-docs",
        status: "ok",
        docs: filteredDocs,
      } satisfies ResQueryDocs);
```

Replace the existing `docs` reference in the `ctx.send.send` call with `filteredDocs`.

- [ ] **Step 4: Run unit tests**

```bash
pnpm test query-filter
```

Expected: all 8 unit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/api/svc/public/app-documents.ts vibes.diy/api/tests/query-filter.test.ts
git commit -m "feat(firefly): extract applyQueryFilter + apply in queryDocsEvento after dedup"
```

---

## Task 4: Thread filter through all transport layers

**Files:**
- Modify: `vibes.diy/vibe/runtime/firefly-database.ts`
- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts`
- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts`

- [ ] **Step 1: Update FireflyTransport interface in firefly-database.ts**

In `vibes.diy/vibe/runtime/firefly-database.ts`, add `QueryFilter` to the imports from `@vibes.diy/vibe-types`:

```ts
import {
  isResPutDoc,
  isResGetDoc,
  isResQueryDocs,
  isResDeleteDoc,
  isEvtDocChanged,
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type QueryFilter,
} from "@vibes.diy/vibe-types";
```

Update the `FireflyTransport` interface (around line 37):

```ts
export interface FireflyTransport {
  readonly svc: { readonly vibeApp: VibeApp };
  putDoc(doc: Record<string, unknown>, docId?: string, dbName?: string): Promise<Result<ResPutDoc>>;
  getDoc(docId: string, dbName?: string): Promise<Result<ResGetDoc | ResGetDocNotFound>>;
  queryDocs(dbName?: string, filter?: QueryFilter): Promise<Result<ResQueryDocs>>;
  deleteDoc(docId: string, dbName?: string): Promise<Result<ResDeleteDoc>>;
  subscribeDocs(dbName?: string): Promise<Result<ResSubscribeDocs>>;
  onMsg(fn: (event: { data: unknown }) => void): void;
}
```

- [ ] **Step 2: Build hint in FireflyDatabase.query()**

In `FireflyDatabase.query()` (around line 218), find the call to `this.vibeApi.queryDocs(this.name)` at line 234. Replace it with hint-detection logic:

```ts
    // Build a server-side filter hint for the simple case:
    // string mapFn (field name) + key / keys / range option.
    const hint: QueryFilter | undefined =
      typeof mapFn === "string" && (opts.key !== undefined || opts.keys !== undefined || opts.range !== undefined)
        ? {
            field: mapFn,
            ...(opts.key !== undefined ? { key: opts.key } : {}),
            ...(opts.keys !== undefined ? { keys: opts.keys } : {}),
            ...(opts.range !== undefined ? { range: opts.range as [unknown, unknown] } : {}),
          }
        : undefined;

    const rRes = await this.vibeApi.queryDocs(this.name, hint);
```

- [ ] **Step 3: Thread filter through VibeSandboxApi.queryDocs in register-dependencies.ts**

In `vibes.diy/vibe/runtime/register-dependencies.ts`, find `queryDocs` (around line 267):

```ts
  queryDocs(dbName = "default"): Promise<Result<ResQueryDocs>> {
    return this.request<ReqQueryDocs, ResQueryDocs>(
      {
        type: "vibes.diy.req-query-docs",
        ...this.svc.vibeApp,
        dbName,
      },
      { wait: isResQueryDocs, timeout: 10000 }
    );
  }
```

Add `QueryFilter` to the import from `@vibes.diy/vibe-types` and update the method:

```ts
  queryDocs(dbName = "default", filter?: QueryFilter): Promise<Result<ResQueryDocs>> {
    return this.request<ReqQueryDocs, ResQueryDocs>(
      {
        type: "vibes.diy.req-query-docs",
        ...this.svc.vibeApp,
        dbName,
        ...(filter !== undefined ? { filter } : {}),
      },
      { wait: isResQueryDocs, timeout: 10000 }
    );
  }
```

- [ ] **Step 4: Thread filter through FireflyApiAdapter.queryDocs**

In `vibes.diy/api/impl/firefly-api-adapter.ts`, add `type QueryFilter` to the existing import from `@vibes.diy/api-types`. Find `queryDocs` (around line 89):

```ts
  async queryDocs(dbName = "default"): Promise<Result<ResQueryDocs, VibesDiyError>> {
    const userSlug = await this.resolveUserSlug();
    return this.api.queryDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug,
      dbName,
    });
  }
```

Update to:

```ts
  async queryDocs(dbName = "default", filter?: QueryFilter): Promise<Result<ResQueryDocs, VibesDiyError>> {
    const userSlug = await this.resolveUserSlug();
    return this.api.queryDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userSlug,
      dbName,
      ...(filter !== undefined ? { filter } : {}),
    });
  }
```

- [ ] **Step 5: Build check**

```bash
pnpm build 2>&1 | head -40
```

Expected: no new TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/runtime/firefly-database.ts vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/api/impl/firefly-api-adapter.ts
git commit -m "feat(firefly): thread QueryFilter hint through FireflyTransport → adapters → FireflyDatabase"
```

---

## Task 5: Integration tests via full API path

**Files:**
- Modify: `vibes.diy/api/tests/app-documents.test.ts`

- [ ] **Step 1: Add filtered queryDocs describe block**

At the end of the existing `describe("Firefly app-documents", ...)` block (before its closing `}`), add these tests. They live inside the same `describe` block and reuse its `beforeAll` setup (`api`, `appSlug`, `userSlug`):

```ts
  describe("queryDocs with filter hint", () => {
    beforeAll(async () => {
      const p = sthis.nextId(4).str;
      await api.putDoc({ userSlug, appSlug, dbName: "filter-test", doc: { status: "active", score: 10 }, docId: `${p}-a1` });
      await api.putDoc({ userSlug, appSlug, dbName: "filter-test", doc: { status: "active", score: 20 }, docId: `${p}-a2` });
      await api.putDoc({ userSlug, appSlug, dbName: "filter-test", doc: { status: "inactive", score: 5 }, docId: `${p}-i1` });
      await api.putDoc({ userSlug, appSlug, dbName: "filter-test", doc: { status: "pending", score: 15 }, docId: `${p}-p1` });
      // Deleted doc — must not appear even if field matches
      const del = `${p}-del`;
      await api.putDoc({ userSlug, appSlug, dbName: "filter-test", doc: { status: "active", score: 99 }, docId: del });
      await api.deleteDoc({ userSlug, appSlug, dbName: "filter-test", docId: del });
    });

    it("no filter returns all non-deleted docs for the db (baseline)", async () => {
      const rRes = await api.queryDocs({ userSlug, appSlug, dbName: "filter-test" });
      expect(rRes.isOk()).toBe(true);
      // 4 docs: a1, a2, i1, p1 (del was deleted)
      expect(rRes.Ok().docs).toHaveLength(4);
    });

    it("key filter: only docs where status === 'active'", async () => {
      const rRes = await api.queryDocs({ userSlug, appSlug, dbName: "filter-test", filter: { field: "status", key: "active" } });
      expect(rRes.isOk()).toBe(true);
      const docs = rRes.Ok().docs;
      expect(docs).toHaveLength(2);
      expect(docs.every((d) => d["status"] === "active")).toBe(true);
    });

    it("keys filter: docs where status is in ['active', 'pending']", async () => {
      const rRes = await api.queryDocs({
        userSlug,
        appSlug,
        dbName: "filter-test",
        filter: { field: "status", keys: ["active", "pending"] },
      });
      expect(rRes.isOk()).toBe(true);
      const docs = rRes.Ok().docs;
      expect(docs).toHaveLength(3);
    });

    it("range filter: docs where score is in [10, 20]", async () => {
      const rRes = await api.queryDocs({
        userSlug,
        appSlug,
        dbName: "filter-test",
        filter: { field: "score", range: [10, 20] },
      });
      expect(rRes.isOk()).toBe(true);
      const docs = rRes.Ok().docs;
      expect(docs).toHaveLength(3); // score 10, 20, 15
    });

    it("deleted doc excluded even when field matches filter", async () => {
      const rRes = await api.queryDocs({ userSlug, appSlug, dbName: "filter-test", filter: { field: "status", key: "active" } });
      expect(rRes.isOk()).toBe(true);
      // del doc was deleted — should not appear
      expect(rRes.Ok().docs).toHaveLength(2);
    });

    it("dedup: latest revision value is what the filter sees", async () => {
      const p = sthis.nextId(4).str;
      const docId = `${p}-dedup`;
      // Write v1 with status=active, then overwrite with status=inactive
      await api.putDoc({ userSlug, appSlug, dbName: "filter-test", doc: { status: "active" }, docId });
      await api.putDoc({ userSlug, appSlug, dbName: "filter-test", doc: { status: "inactive" }, docId });
      // Filter for active — should NOT return this doc (latest is inactive)
      const rActive = await api.queryDocs({ userSlug, appSlug, dbName: "filter-test", filter: { field: "status", key: "active" } });
      expect(rActive.Ok().docs.find((d) => d._id === docId)).toBeUndefined();
      // Filter for inactive — should return this doc
      const rInactive = await api.queryDocs({ userSlug, appSlug, dbName: "filter-test", filter: { field: "status", key: "inactive" } });
      expect(rInactive.Ok().docs.find((d) => d._id === docId)).toBeDefined();
    });
  });
```

- [ ] **Step 2: Run integration tests**

```bash
pnpm test app-documents
```

Expected: all new tests PASS (server filter is already wired in Task 3; transport threading is done in Task 4).

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/app-documents.test.ts
git commit -m "test(firefly): integration tests for queryDocs filter hint"
```

---

## Task 6: Update FireflyApiAdapter test

**Files:**
- Modify: `vibes.diy/api/impl/firefly-api-adapter.test.ts`

- [ ] **Step 1: Add filter-threading test**

In `vibes.diy/api/impl/firefly-api-adapter.test.ts`, find the existing `"queryDocs routes through VibesDiyApi.queryDocs"` test (around line 98) and add a new test after it:

```ts
  it("queryDocs passes filter hint to VibesDiyApi.queryDocs when provided", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    const filter = { field: "status", key: "active" };
    await adapter.queryDocs("todos", filter);
    expect(queryDocs).toHaveBeenCalledWith({
      appSlug: "my-app",
      userSlug: "alice",
      dbName: "todos",
      filter,
    });
  });

  it("queryDocs omits filter key when filter is undefined", async () => {
    const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
    const api = fakeVibesDiyApi({ queryDocs });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await adapter.queryDocs("todos");
    expect(queryDocs).toHaveBeenCalledWith({ appSlug: "my-app", userSlug: "alice", dbName: "todos" });
  });
```

- [ ] **Step 2: Run adapter tests**

```bash
pnpm test firefly-api-adapter
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/impl/firefly-api-adapter.test.ts
git commit -m "test(firefly): verify FireflyApiAdapter threads filter hint through to VibesDiyApi"
```

---

## Task 7: Final check

- [ ] **Step 1: Run all tests**

```bash
pnpm test 2>&1 | tail -30
```

Expected: all test suites pass. No regressions in `app-documents`, `query-filter`, or `firefly-api-adapter`.

- [ ] **Step 2: Run fast-check (format + build)**

```bash
pnpm fast-check
```

Expected: clean.
