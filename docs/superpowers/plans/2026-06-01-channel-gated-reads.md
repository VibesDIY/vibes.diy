# Channel-Gated Reads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter queryDocs and getDoc results by channel membership when an access function binding exists, so channels actually isolate data on reads.

**Architecture:** JS-filter approach (Option B from spec). After fetching docs (existing behavior), look up the access fn binding, query AccessFnOutputs for per-doc channel assignments, build the grant reduce, and filter docs to only those the requesting user can access. No SQL views or migrations needed.

**Tech Stack:** TypeScript, Drizzle ORM, GrantReduce module, Vitest

**Spec:** `docs/superpowers/specs/2026-06-01-channel-gated-reads-design.md`

---

## File Structure

| File                                                       | Responsibility                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `vibes.diy/api/svc/public/channel-read-filter.ts` (new)    | Pure function: given docs, AccessFnOutputs rows, user handle → filtered docs. Reusable by both queryDocs and getDoc. |
| `vibes.diy/api/svc/public/app-documents.ts` (modify)       | Wire the filter into queryDocsEvento and getDocEvento after existing ACL checks                                      |
| `vibes.diy/api/tests/access-fn-channel-read.test.ts` (new) | Integration tests for channel-gated reads                                                                            |

---

### Task 1: Channel read filter — pure logic module

**Files:**

- Create: `vibes.diy/api/svc/public/channel-read-filter.ts`
- Create: `vibes.diy/api/tests/access-fn-channel-read-unit.test.ts`

The filter function takes a list of docs, the AccessFnOutputs rows for those docs, and the requesting user's handle. It returns only the docs the user can see. This is a pure function with no DB access — all data is passed in.

- [ ] **Step 1: Write the unit tests**

Create `vibes.diy/api/tests/access-fn-channel-read-unit.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { filterDocsByChannel } from "../svc/public/channel-read-filter.js";

const mkOutput = (docId: string, output: Record<string, unknown>) => ({
  docId,
  output: JSON.stringify(output),
});

describe("filterDocsByChannel (unit)", () => {
  it("returns all docs when no access fn outputs exist (empty outputs array)", () => {
    const docs = [
      { _id: "d1", title: "hello" },
      { _id: "d2", title: "world" },
    ];
    const result = filterDocsByChannel(docs, [], null, new Set(), new Set());
    expect(result).toEqual(docs);
  });

  it("filters docs to user's effective channels", () => {
    const docs = [
      { _id: "d1", title: "in-channel" },
      { _id: "d2", title: "not-in-channel" },
    ];
    const outputs = [mkOutput("d1", { channels: ["general"] }), mkOutput("d2", { channels: ["secret"] })];
    const effectiveChannels = new Set(["general"]);
    const publicChannels = new Set<string>();
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, publicChannels);
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("includes docs in public channels for anonymous users", () => {
    const docs = [
      { _id: "d1", title: "public-doc" },
      { _id: "d2", title: "private-doc" },
    ];
    const outputs = [mkOutput("d1", { channels: ["announcements"] }), mkOutput("d2", { channels: ["secret"] })];
    const effectiveChannels = new Set<string>();
    const publicChannels = new Set(["announcements"]);
    const result = filterDocsByChannel(docs, outputs, null, effectiveChannels, publicChannels);
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("excludes docs with no channels in output", () => {
    const docs = [
      { _id: "d1", title: "has-channel" },
      { _id: "d2", title: "no-channel" },
    ];
    const outputs = [mkOutput("d1", { channels: ["general"] }), mkOutput("d2", { allowAnonymous: true })];
    const effectiveChannels = new Set(["general"]);
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set());
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("excludes docs with no stored output", () => {
    const docs = [
      { _id: "d1", title: "has-output" },
      { _id: "d2", title: "no-output" },
    ];
    const outputs = [mkOutput("d1", { channels: ["general"] })];
    const effectiveChannels = new Set(["general"]);
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set());
    expect(result.length).toBe(1);
    expect(result[0]?._id).toBe("d1");
  });

  it("doc in multiple channels passes if user has any one", () => {
    const docs = [{ _id: "d1", title: "multi-channel" }];
    const outputs = [mkOutput("d1", { channels: ["alpha", "beta"] })];
    const effectiveChannels = new Set(["beta"]);
    const result = filterDocsByChannel(docs, outputs, "user-a", effectiveChannels, new Set());
    expect(result.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run vibes.diy/api/tests/access-fn-channel-read-unit.test.ts
```

Expected: FAIL — `filterDocsByChannel` not found.

- [ ] **Step 3: Implement the filter function**

Create `vibes.diy/api/svc/public/channel-read-filter.ts`:

```typescript
interface OutputRow {
  docId: string;
  output: string;
}

type Doc = { _id: string } & Record<string, unknown>;

export function filterDocsByChannel(
  docs: Doc[],
  outputRows: OutputRow[],
  userHandle: string | null,
  effectiveChannels: Set<string>,
  publicChannels: Set<string>
): Doc[] {
  if (outputRows.length === 0) return docs;

  const docChannels = new Map<string, string[]>();
  for (const row of outputRows) {
    const parsed = JSON.parse(row.output) as { channels?: string[] };
    if (parsed.channels !== undefined && Array.isArray(parsed.channels)) {
      docChannels.set(row.docId, parsed.channels);
    }
  }

  return docs.filter((doc) => {
    const channels = docChannels.get(doc._id);
    if (channels === undefined) return false;
    for (const ch of channels) {
      if (effectiveChannels.has(ch) || publicChannels.has(ch)) return true;
    }
    return false;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run vibes.diy/api/tests/access-fn-channel-read-unit.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Run prettier and commit**

```bash
npx prettier --write vibes.diy/api/svc/public/channel-read-filter.ts vibes.diy/api/tests/access-fn-channel-read-unit.test.ts
git add vibes.diy/api/svc/public/channel-read-filter.ts vibes.diy/api/tests/access-fn-channel-read-unit.test.ts
git commit -m "feat(firefly): add channel read filter pure logic module

filterDocsByChannel filters a doc list by channel membership using
pre-queried AccessFnOutputs rows and resolved effective/public channels.
Used by both queryDocs and getDoc read paths.

6 unit tests covering: user channels, public channels, no channels,
no stored output, multi-channel docs, empty outputs passthrough."
```

---

### Task 2: Wire channel filter into queryDocsEvento

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents.ts` (queryDocsEvento handler, ~line 606-690)

Insert channel filtering after the dedup/delete loop and before `applyQueryFilter`. The pattern: look up access fn binding → if exists, query AccessFnOutputs for all docs → build reduce → resolve channels → filter.

- [ ] **Step 1: Add import for the channel filter**

In `vibes.diy/api/svc/public/app-documents.ts`, after the existing import of `GrantReduce, extractContribution`:

```typescript
import { filterDocsByChannel } from "./channel-read-filter.js";
```

- [ ] **Step 2: Add the channel filter block to queryDocsEvento**

In the queryDocsEvento handler, find the block that builds the `docs` array (around line 666-679 on origin/main). After the loop that builds `docs` and before `const filteredDocs = applyQueryFilter(...)`, insert:

```typescript
// Channel-gated read filter: if an access fn binding exists for this db,
// filter docs to only those in the user's effective channels or public channels.
const tAfb = vctx.sql.tables.accessFunctionBindings;
const afbRow = await vctx.sql.db
  .select({ accessFnCid: tAfb.accessFnCid })
  .from(tAfb)
  .where(and(eq(tAfb.userHandle, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), eq(tAfb.dbName, req.dbName)))
  .limit(1)
  .then((r) => r[0]);

let channelFilteredDocs = docs;
if (afbRow?.accessFnCid) {
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const allOutputs = await vctx.sql.db
    .select({ docId: tOutputs.docId, output: tOutputs.output })
    .from(tOutputs)
    .where(
      and(
        eq(tOutputs.userHandle, req.ownerHandle),
        eq(tOutputs.appSlug, req.appSlug),
        eq(tOutputs.dbName, req.dbName),
        eq(tOutputs.fnCid, afbRow.accessFnCid)
      )
    );

  const grantOutputs = await vctx.sql.db
    .select({ docId: tOutputs.docId, output: tOutputs.output })
    .from(tOutputs)
    .where(
      and(
        eq(tOutputs.userHandle, req.ownerHandle),
        eq(tOutputs.appSlug, req.appSlug),
        eq(tOutputs.dbName, req.dbName),
        eq(tOutputs.fnCid, afbRow.accessFnCid),
        eq(tOutputs.hasGrants, 1)
      )
    );

  const reduce = new GrantReduce();
  for (const row of grantOutputs) {
    reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
  }

  const userHandle = req._auth
    ? await vctx.sql.db
        .select({ handle: vctx.sql.tables.handleBinding.handle })
        .from(vctx.sql.tables.handleBinding)
        .where(eq(vctx.sql.tables.handleBinding.userId, req._auth.verifiedAuth.claims.userId))
        .limit(1)
        .then((r) => r[0]?.handle ?? null)
    : null;

  const effectiveChannels = userHandle !== null ? reduce.resolveEffectiveChannels(userHandle) : new Set<string>();
  channelFilteredDocs = filterDocsByChannel(docs, allOutputs, userHandle, effectiveChannels, reduce.publicChannels);
}
```

Then change the `applyQueryFilter` call from:

```typescript
const filteredDocs = applyQueryFilter(docs, req.filter);
```

to:

```typescript
const filteredDocs = applyQueryFilter(channelFilteredDocs, req.filter);
```

- [ ] **Step 3: Run fast-check**

```bash
pnpm fast-check
```

Expected: Build + rules-bag pass.

- [ ] **Step 4: Run prettier and commit**

```bash
npx prettier --write vibes.diy/api/svc/public/app-documents.ts
git add vibes.diy/api/svc/public/app-documents.ts
git commit -m "feat(firefly): add channel-gated read filter to queryDocsEvento

When an access function binding exists for a database, queryDocs now
filters results to only docs whose channels overlap the requesting
user's effective channels or publicChannels. Databases without access
functions keep current behavior (all docs visible)."
```

---

### Task 3: Wire channel filter into getDocEvento

**Files:**

- Modify: `vibes.diy/api/svc/public/app-documents.ts` (getDocEvento handler, ~line 495-560)

Same pattern as queryDocs but for a single doc. After fetching the doc and before returning it, check if the doc is in the user's channels. If not, return `not-found` (don't leak existence).

- [ ] **Step 1: Add channel filter to getDocEvento**

In the getDocEvento handler, after the `if (!row || row.deleted === 1)` early return and before the `mintFilesUrls` call, insert:

```typescript
// Channel-gated read: if access fn binding exists, verify doc is in user's channels
const tAfb = vctx.sql.tables.accessFunctionBindings;
const afbRow = await vctx.sql.db
  .select({ accessFnCid: tAfb.accessFnCid })
  .from(tAfb)
  .where(and(eq(tAfb.userHandle, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), eq(tAfb.dbName, req.dbName)))
  .limit(1)
  .then((r) => r[0]);

if (afbRow?.accessFnCid) {
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const docOutput = await vctx.sql.db
    .select({ output: tOutputs.output })
    .from(tOutputs)
    .where(
      and(
        eq(tOutputs.userHandle, req.ownerHandle),
        eq(tOutputs.appSlug, req.appSlug),
        eq(tOutputs.dbName, req.dbName),
        eq(tOutputs.docId, req.docId),
        eq(tOutputs.fnCid, afbRow.accessFnCid)
      )
    )
    .limit(1)
    .then((r) => r[0]);

  const parsed = docOutput ? (JSON.parse(docOutput.output) as { channels?: string[] }) : undefined;
  const docChannels = parsed?.channels;

  if (docChannels === undefined || docChannels.length === 0) {
    await ctx.send.send(ctx, {
      type: "vibes.diy.res-get-doc",
      status: "not-found",
      id: req.docId,
    } satisfies ResGetDocNotFound);
    return Result.Ok(EventoResult.Continue);
  }

  const grantOutputs = await vctx.sql.db
    .select({ docId: tOutputs.docId, output: tOutputs.output })
    .from(tOutputs)
    .where(
      and(
        eq(tOutputs.userHandle, req.ownerHandle),
        eq(tOutputs.appSlug, req.appSlug),
        eq(tOutputs.dbName, req.dbName),
        eq(tOutputs.fnCid, afbRow.accessFnCid),
        eq(tOutputs.hasGrants, 1)
      )
    );

  const reduce = new GrantReduce();
  for (const r of grantOutputs) {
    reduce.addDoc(r.docId, extractContribution(JSON.parse(r.output) as AccessDescriptor));
  }

  const userHandle = req._auth
    ? await vctx.sql.db
        .select({ handle: vctx.sql.tables.handleBinding.handle })
        .from(vctx.sql.tables.handleBinding)
        .where(eq(vctx.sql.tables.handleBinding.userId, req._auth.verifiedAuth.claims.userId))
        .limit(1)
        .then((r) => r[0]?.handle ?? null)
    : null;

  const effectiveChannels = userHandle !== null ? reduce.resolveEffectiveChannels(userHandle) : new Set<string>();
  const hasAccess = docChannels.some((ch) => effectiveChannels.has(ch) || reduce.publicChannels.has(ch));

  if (!hasAccess) {
    await ctx.send.send(ctx, {
      type: "vibes.diy.res-get-doc",
      status: "not-found",
      id: req.docId,
    } satisfies ResGetDocNotFound);
    return Result.Ok(EventoResult.Continue);
  }
}
```

- [ ] **Step 2: Run fast-check**

```bash
pnpm fast-check
```

Expected: Pass.

- [ ] **Step 3: Run prettier and commit**

```bash
npx prettier --write vibes.diy/api/svc/public/app-documents.ts
git add vibes.diy/api/svc/public/app-documents.ts
git commit -m "feat(firefly): add channel-gated read filter to getDocEvento

When an access function binding exists, getDoc checks if the requested
doc is in the user's effective channels or publicChannels. Returns
not-found for inaccessible docs (doesn't leak existence)."
```

---

### Task 4: Integration tests for channel-gated reads

**Files:**

- Create: `vibes.diy/api/tests/access-fn-channel-read.test.ts`

End-to-end tests using the existing test infrastructure (createVibeDiyTestCtx, mock invokeAccessFn). Seed AccessFunctionBindings + AccessFnOutputs rows, then verify queryDocs and getDoc filter correctly.

- [ ] **Step 1: Write integration tests**

Create `vibes.diy/api/tests/access-fn-channel-read.test.ts`:

```typescript
import { assert, beforeAll, describe, expect, it } from "vitest";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk } from "@vibes.diy/api-types";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { eq, and } from "drizzle-orm";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const CID = "test-channel-read-cid";

interface InvokeRecorder {
  calls: { cid: string; user: unknown }[];
  result: AccessDescriptor | { forbidden: string };
}

async function setupCtx(recorder: InvokeRecorder) {
  const sthis = ensureSuperThis();
  const deviceCA = await createTestDeviceCA(sthis);
  const ctx = await createVibeDiyTestCtx(sthis, deviceCA, {
    invokeAccessFn: async (params) => {
      recorder.calls.push({ cid: params.cid, user: params.user });
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

describe("channel-gated reads (integration)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let ownerApi: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  const recorder: InvokeRecorder = { calls: [], result: { channels: ["general"], allowAnonymous: true } };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 900);
    ownerApi = ownerSetup.api;
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [{ type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` }],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Seed access fn binding
    await appCtx.vibesCtx.sql.db.insert(appCtx.vibesCtx.sql.tables.accessFunctionBindings).values({
      userHandle: ownerHandle,
      appSlug,
      dbName: "chat",
      accessFnCid: CID,
      updated: new Date().toISOString(),
    });

    // Write two docs through the access fn gate — one in "general", one in "secret"
    recorder.result = { channels: ["general"], allowAnonymous: true };
    const r1 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "public-msg" } });
    assert(r1.isOk(), "first putDoc failed");

    recorder.result = { channels: ["secret"], allowAnonymous: true };
    const r2 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "secret-msg" } });
    assert(r2.isOk(), "second putDoc failed");

    // Reset recorder for reads
    recorder.calls = [];
    recorder.result = { channels: ["general"], allowAnonymous: true };
  }, 30000);

  it("queryDocs returns only docs in user's channels", async () => {
    // The owner wrote both docs. Owner's handle is in the handleBinding.
    // The access fn outputs have channels ["general"] and ["secret"].
    // Without grant-based channel resolution, the owner has no effective channels
    // unless we seed grants. Let's seed a direct grant for the owner → "general".
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;

    // Seed a grant-producing output so the owner gets "general" channel access
    await appCtx.vibesCtx.sql.db
      .insert(tOutputs)
      .values({
        userHandle: ownerHandle,
        appSlug,
        dbName: "chat",
        docId: "grant-doc",
        fnCid: CID,
        output: JSON.stringify({
          grant: { users: { [ownerHandle]: ["general"] } },
        }),
        hasGrants: 1,
      })
      .onConflictDoUpdate({
        target: [tOutputs.userHandle, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
        set: {
          output: JSON.stringify({ grant: { users: { [ownerHandle]: ["general"] } } }),
          hasGrants: 1,
        },
      });

    const res = await ownerApi.queryDocs({ ownerHandle, appSlug, dbName: "chat" });
    expect(res.isOk()).toBe(true);
    const docs = res.Ok().docs;

    // Should only see the "general" doc, not the "secret" one
    expect(docs.length).toBe(1);
    expect(docs[0]?.title).toBe("public-msg");
  });

  it("getDoc returns not-found for doc in inaccessible channel", async () => {
    // Find the docId of the secret doc
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const secretRows = await appCtx.vibesCtx.sql.db
      .select({ docId: tOutputs.docId, output: tOutputs.output })
      .from(tOutputs)
      .where(
        and(
          eq(tOutputs.userHandle, ownerHandle),
          eq(tOutputs.appSlug, appSlug),
          eq(tOutputs.dbName, "chat"),
          eq(tOutputs.fnCid, CID)
        )
      );

    const secretDoc = secretRows.find((r) => {
      const parsed = JSON.parse(r.output) as { channels?: string[] };
      return parsed.channels?.includes("secret");
    });
    assert(secretDoc !== undefined, "secret doc output not found");

    const res = await ownerApi.getDoc({ ownerHandle, appSlug, dbName: "chat", docId: secretDoc.docId });
    expect(res.isOk()).toBe(true);
    const getRes = res.Ok();
    expect(getRes.status).toBe("not-found");
  });

  it("queryDocs returns all docs when no access fn binding", async () => {
    // Use a different dbName with no binding
    recorder.result = { allowAnonymous: true };
    const r1 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "notes", doc: { title: "note-1" } });
    assert(r1.isOk());
    const r2 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "notes", doc: { title: "note-2" } });
    assert(r2.isOk());

    const res = await ownerApi.queryDocs({ ownerHandle, appSlug, dbName: "notes" });
    expect(res.isOk()).toBe(true);
    expect(res.Ok().docs.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npx vitest run vibes.diy/api/tests/access-fn-channel-read.test.ts
```

Expected: All 3 tests PASS (the channel filter is already wired from Tasks 2-3).

- [ ] **Step 3: Run prettier and commit**

```bash
npx prettier --write vibes.diy/api/tests/access-fn-channel-read.test.ts
git add vibes.diy/api/tests/access-fn-channel-read.test.ts
git commit -m "test(firefly): integration tests for channel-gated reads

Covers: queryDocs filters by channel, getDoc returns not-found for
inaccessible channels, queryDocs returns all docs when no access fn
binding exists."
```

---

### Task 5: Final check and cleanup

- [ ] **Step 1: Run full pnpm fast-check**

```bash
pnpm fast-check
```

Expected: All checks pass.

- [ ] **Step 2: Run all access fn tests together**

```bash
npx vitest run vibes.diy/api/tests/access-fn-channel-read-unit.test.ts vibes.diy/api/tests/access-fn-channel-read.test.ts vibes.diy/api/tests/access-fn-invoke.test.ts
```

Expected: All tests pass (unit + integration + existing invoke tests).

- [ ] **Step 3: Run prettier on all changed files**

```bash
npx prettier --write vibes.diy/api/svc/public/channel-read-filter.ts vibes.diy/api/svc/public/app-documents.ts vibes.diy/api/tests/access-fn-channel-read-unit.test.ts vibes.diy/api/tests/access-fn-channel-read.test.ts
```
