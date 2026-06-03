# access.js fileSystem Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down every observable behavior of the access.js extraction logic so the 250-line inline block in `ensure-app-slug-item.ts` can be refactored stress-free.

**Architecture:** One new integration test file (`access-fn-filesystem.test.ts`) covering fileSystem storage, sandbox serving, version timeline carry-forward, and binding creation via the front door. Two existing test files (`access-fn-invoke.test.ts`, `access-fn-channel-read.test.ts`) updated to use extraction-based setup instead of manual DB seeding. All tests use the existing `createVibeDiyTestCtx` + `VibesDiyApi` DI pattern — no mocking.

**Tech Stack:** vitest, drizzle-orm, `@vibes.diy/api-svc`, `@vibes.diy/api-impl`, `@vibes.diy/api-types`, `@adviser/cement`

---

## Refactor note: delete JS_PROTO_NAMES blocklist

The extraction logic has a `JS_PROTO_NAMES` set that filters out JS built-in globals (`toString`, `constructor`, `__proto__`, etc.) from export names. This is a fallback defending against a problem that `export { fn as "dbName" }` already solves cleanly — if someone names their db "toString", the `as` syntax handles it. Per rules-bag ("never add a fallback"), the refactor should delete `JS_PROTO_NAMES` entirely. We intentionally do NOT add test coverage for it — the `export-as` test covers the real use case for odd-but-valid names.

---

## File Structure

- **Create:** `vibes.diy/api/tests/access-fn-filesystem.test.ts` — new integration tests for fileSystem invariant
- **Modify:** `vibes.diy/api/tests/access-fn-invoke.test.ts` — replace manual DB seeding with extraction-based setup
- **Modify:** `vibes.diy/api/tests/access-fn-channel-read.test.ts` — replace manual DB seeding with extraction-based setup

---

### Task 1: New test — access.js lands in apps.fileSystem after push

**Files:**
- Create: `vibes.diy/api/tests/access-fn-filesystem.test.ts`

- [ ] **Step 1: Write the test file with shared setup and first test**

```ts
import { assert, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import { Result, TestWSPair } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { createTestDeviceCA, createTestUser } from "@fireproof/core-device-id";
import { VibesDiyApi } from "@vibes.diy/api-impl";
import { calcEntryPointUrl, vibesMsgEvento, WSSendProvider } from "@vibes.diy/api-svc";
import { isResEnsureAppSlugOk, parseArray, fileSystemItem } from "@vibes.diy/api-types";
import type { AccessDescriptor, FileSystemItem } from "@vibes.diy/api-types";
import { createVibeDiyTestCtx } from "./vibe-diy-test-ctx.js";

const ACCESS_JS_CHAT_AND_DEFAULT = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}
export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  return {};
}`;

const ACCESS_JS_CHAT_ONLY = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}`;

const ACCESS_JS_CHAT_AND_BOARDS = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}
export function boards(doc, oldDoc, user) {
  return { allowAnonymous: true };
}`;

const APP_JSX = `function App() { return null; } App();`;

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

function queryBindings(
  ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>,
  ownerHandle: string,
  appSlug: string
) {
  const tAfb = ctx.vibesCtx.sql.tables.accessFunctionBindings;
  return ctx.vibesCtx.sql.db
    .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid, accessFnAssetUri: tAfb.accessFnAssetUri })
    .from(tAfb)
    .where(and(eq(tAfb.userSlug, ownerHandle), eq(tAfb.appSlug, appSlug)));
}

function queryAppsFileSystem(
  ctx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>,
  ownerHandle: string,
  appSlug: string,
  fsId: string
): Promise<FileSystemItem[]> {
  return ctx.vibesCtx.sql.db
    .select({ fileSystem: ctx.vibesCtx.sql.tables.apps.fileSystem })
    .from(ctx.vibesCtx.sql.tables.apps)
    .where(
      and(
        eq(ctx.vibesCtx.sql.tables.apps.ownerHandle, ownerHandle),
        eq(ctx.vibesCtx.sql.tables.apps.appSlug, appSlug),
        eq(ctx.vibesCtx.sql.tables.apps.fsId, fsId)
      )
    )
    .limit(1)
    .then((rows) => {
      if (rows.length === 0) return [];
      return parseArray(rows[0].fileSystem, fileSystemItem);
    });
}

describe("access.js fileSystem invariant (#2188)", { timeout: 30000 }, () => {
  let appCtx: Awaited<ReturnType<typeof createVibeDiyTestCtx>>;
  let api: VibesDiyApi;
  let appSlug: string;
  let ownerHandle: string;
  let fsId: string;
  const recorder: InvokeRecorder = { calls: [], result: { allowAnonymous: true } };

  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 2188);
    api = ownerSetup.api;
  }, 30000);

  it("access.js lands in apps.fileSystem after push", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_AND_DEFAULT },
      ],
    });
    assert(r.isOk(), `ensureAppSlug failed: ${r.isErr() ? String(r.Err()) : ""}`);
    const res = r.Ok();
    assert(isResEnsureAppSlugOk(res), "expected ResEnsureAppSlugOk");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;
    fsId = res.fsId;

    const fsItems = await queryAppsFileSystem(appCtx, ownerHandle, appSlug, fsId);
    const accessEntry = fsItems.find((item) => item.fileName === "/access.js");
    expect(accessEntry).toBeDefined();
    expect(accessEntry?.mimeType).toBe("text/javascript");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-filesystem.test.ts`
Expected: 1 test PASS

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-filesystem.test.ts
git commit -m "test: access.js lands in apps.fileSystem after push (#2188)"
```

---

### Task 2: Sandbox serves /access.js?source=true

**Files:**
- Modify: `vibes.diy/api/tests/access-fn-filesystem.test.ts`

- [ ] **Step 1: Add sandbox serving test**

Add inside the `describe` block, after the first test:

```ts
  it("sandbox serves /access.js?source=true", async () => {
    const url = calcEntryPointUrl({
      hostnameBase: ".nowhere",
      protocol: "http",
      port: "4711",
      bindings: { appSlug, ownerHandle, fsId },
    });
    const origin = new URL(url).origin;
    const sourceRes = await api.cfg.fetch(`${origin}/access.js?source=true`);
    expect(sourceRes.status).toBe(200);
    const content = await sourceRes.text();
    expect(content).toContain("export function chat");
    expect(content).toContain("export default function");
  });
```

- [ ] **Step 2: Run tests to verify both pass**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-filesystem.test.ts`
Expected: 2 tests PASS

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-filesystem.test.ts
git commit -m "test: sandbox serves /access.js?source=true (#2188)"
```

---

### Task 3: Binding rows created via front door + CID matches fileSystem

**Files:**
- Modify: `vibes.diy/api/tests/access-fn-filesystem.test.ts`

- [ ] **Step 1: Add binding creation and CID match tests**

Add inside the `describe` block:

```ts
  it("binding rows created via extraction (not manual DB insert)", async () => {
    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNames = bindings.map((b) => b.dbName).sort();
    expect(dbNames).toContain("chat");
    expect(dbNames).toContain("*");
  });

  it("binding CID matches fileSystem CID (single source of truth)", async () => {
    const fsItems = await queryAppsFileSystem(appCtx, ownerHandle, appSlug, fsId);
    const accessEntry = fsItems.find((item) => item.fileName === "/access.js");
    assert(accessEntry !== undefined, "/access.js not found in fileSystem");

    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    expect(bindings.length).toBeGreaterThan(0);
    for (const binding of bindings) {
      expect(binding.accessFnCid).toBe(accessEntry.assetId);
      expect(binding.accessFnAssetUri).toBe(accessEntry.assetURI);
    }
  });
```

  it("export-as syntax creates binding for non-identifier db name", async () => {
    const ACCESS_JS_EXPORT_AS = `function myHandler(doc, oldDoc, user) {
  return { allowAnonymous: true };
}
export { myHandler as "my-db" }`;

    const r = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_EXPORT_AS },
      ],
    });
    assert(r.isOk(), "push with export-as failed");

    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNames = bindings.map((b) => b.dbName);
    expect(dbNames).toContain("my-db");
  });
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-filesystem.test.ts`
Expected: 5 tests PASS

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-filesystem.test.ts
git commit -m "test: binding rows created via front door, CID matches fileSystem, export-as syntax (#2188)"
```

---

### Task 4: Stale bindings cleaned up + all bindings deleted on access.js removal

**Files:**
- Modify: `vibes.diy/api/tests/access-fn-filesystem.test.ts`

- [ ] **Step 1: Add stale cleanup and removal tests**

Add inside the `describe` block:

```ts
  it("stale binding rows cleaned up when export removed", async () => {
    const r1 = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_AND_BOARDS },
      ],
    });
    assert(r1.isOk(), "push with chat+boards failed");

    const bindingsBoth = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNamesBoth = bindingsBoth.map((b) => b.dbName).sort();
    expect(dbNamesBoth).toContain("chat");
    expect(dbNamesBoth).toContain("boards");

    const r2 = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_ONLY },
      ],
    });
    assert(r2.isOk(), "push with chat-only failed");

    const bindingsAfter = await queryBindings(appCtx, ownerHandle, appSlug);
    const dbNamesAfter = bindingsAfter.map((b) => b.dbName);
    expect(dbNamesAfter).toContain("chat");
    expect(dbNamesAfter).not.toContain("boards");
  });

  it("all bindings deleted when access.js removed from push", async () => {
    const r = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
      ],
    });
    assert(r.isOk(), "push without access.js failed");

    const bindings = await queryBindings(appCtx, ownerHandle, appSlug);
    expect(bindings.length).toBe(0);
  });
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-filesystem.test.ts`
Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-filesystem.test.ts
git commit -m "test: stale binding cleanup and access.js removal (#2188)"
```

---

### Task 5: Backfill runs through front door

**Files:**
- Modify: `vibes.diy/api/tests/access-fn-filesystem.test.ts`

- [ ] **Step 1: Add backfill integration test**

Add inside the `describe` block:

```ts
  it("backfill creates accessFnOutputs via front door", async () => {
    recorder.result = { channels: ["general"], allowAnonymous: true };

    const rSetup = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
      ],
    });
    assert(rSetup.isOk(), "setup push failed");

    // Temporarily seed a binding so putDoc goes through the gate
    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    await appCtx.vibesCtx.sql.db.insert(tAfb).values({
      userSlug: ownerHandle,
      appSlug,
      dbName: "chat",
      accessFnCid: "temp-seed-cid",
      updated: new Date().toISOString(),
    });

    const r1 = await api.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "backfill-doc-1" } });
    assert(r1.isOk(), "putDoc 1 failed");
    const r2 = await api.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "backfill-doc-2" } });
    assert(r2.isOk(), "putDoc 2 failed");

    // Clean up temp seed
    await appCtx.vibesCtx.sql.db
      .delete(tAfb)
      .where(and(eq(tAfb.userSlug, ownerHandle), eq(tAfb.appSlug, appSlug)));
    await appCtx.vibesCtx.sql.db
      .delete(appCtx.vibesCtx.sql.tables.accessFnOutputs)
      .where(
        and(
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.userSlug, ownerHandle),
          eq(appCtx.vibesCtx.sql.tables.accessFnOutputs.appSlug, appSlug)
        )
      );

    recorder.calls = [];

    const rAccess = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_ONLY },
      ],
    });
    assert(rAccess.isOk(), "push with access.js failed");

    const backfillCalls = recorder.calls.filter((c) => c.user === null);
    expect(backfillCalls.length).toBe(2);

    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    const outputRows = await appCtx.vibesCtx.sql.db
      .select()
      .from(tOutputs)
      .where(and(eq(tOutputs.userSlug, ownerHandle), eq(tOutputs.appSlug, appSlug), eq(tOutputs.dbName, "chat")));
    expect(outputRows.length).toBe(2);
  });
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-filesystem.test.ts`
Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-filesystem.test.ts
git commit -m "test: backfill accessFnOutputs via front door (#2188)"
```

---

### Task 6: Version timeline carries access.js forward

**Files:**
- Modify: `vibes.diy/api/tests/access-fn-filesystem.test.ts`

- [ ] **Step 1: Add version timeline carry-forward test**

Add this import at the top of the file:

```ts
import { resolveCodeBlocksToFileSystem } from "@vibes.diy/api-svc";
import { loadVersionTimeline } from "../svc/intern/version-timeline.js";
```

Add inside the `describe` block:

```ts
  it("access.js carries forward in version timeline seed", async () => {
    const rPush = await api.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: APP_JSX },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT_ONLY },
      ],
    });
    assert(rPush.isOk(), "push with access.js failed");
    const pushRes = rPush.Ok();
    assert(isResEnsureAppSlugOk(pushRes), "expected ResEnsureAppSlugOk");

    const rOpen = await api.openChat({ ownerHandle, appSlug, mode: "chat" });
    assert(rOpen.isOk(), "openChat failed");
    const chat = rOpen.Ok();

    const tlResult = await loadVersionTimeline(appCtx.vibesCtx, chat.chatId);
    assert(tlResult.isOk(), "loadVersionTimeline failed");
    const timeline = tlResult.Ok();
    expect(timeline.length).toBeGreaterThan(0);

    const latestVfs = timeline[timeline.length - 1].vfs;
    expect(latestVfs.has("/access.js")).toBe(true);

    const appEditBlock = {
      begin: { type: "block.code.begin" as const, blockId: "b1", blockNr: 1, streamId: "s1", seq: 1, timestamp: new Date(), sectionId: "sec1", lang: "jsx", path: "App.jsx" },
      lines: [{ type: "block.code.line" as const, blockId: "b1", blockNr: 1, streamId: "s1", seq: 2, timestamp: new Date(), sectionId: "sec1", lang: "jsx", line: "function App() { return null; } // edited", lineNr: 1 }],
      end: { type: "block.code.end" as const, blockId: "b1", blockNr: 1, streamId: "s1", seq: 3, timestamp: new Date(), sectionId: "sec1", lang: "jsx", stats: { lines: 1, bytes: 50 } },
    };

    const resolved = resolveCodeBlocksToFileSystem([appEditBlock], latestVfs);
    const accessFile = resolved.find((f) => f.filename === "/access.js");
    expect(accessFile).toBeDefined();
    expect(accessFile?.type).toBe("code-block");

    await chat.close();
  });
```

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-filesystem.test.ts`
Expected: 9 tests PASS

- [ ] **Step 3: Commit**

```bash
git add vibes.diy/api/tests/access-fn-filesystem.test.ts
git commit -m "test: access.js carries forward in version timeline seed (#2188)"
```

---

### Task 7: Fix access-fn-invoke.test.ts — extraction-based setup

**Files:**
- Modify: `vibes.diy/api/tests/access-fn-invoke.test.ts`

- [ ] **Step 1: Replace manual DB seeding with access.js push**

Replace the constant, remove `seedBinding`, update `beforeAll`:

Remove these lines:
```ts
const CID = "test-access-fn-cid";
```
and the entire `seedBinding` function (lines 63–74).

Add an access.js constant after the `InvokeRecorder` interface:

```ts
const ACCESS_JS_DEFAULT = `export default function(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save" };
  return { allowAnonymous: true };
}`;
```

Replace the `beforeAll` body (keep the signature and timeout) with:

```ts
  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 800);
    ownerApi = ownerSetup.api;
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_DEFAULT },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Read actual CID from the binding the extraction logic created
    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    const bindings = await appCtx.vibesCtx.sql.db
      .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.userSlug, ownerHandle), eq(tAfb.appSlug, appSlug)));
    const wildcardBinding = bindings.find((b) => b.dbName === "*");
    assert(wildcardBinding !== undefined, "extraction must create a '*' binding for export default");
    actualCid = wildcardBinding.accessFnCid;
  }, 30000);
```

Add `let actualCid: string;` alongside the other `let` declarations at the top of the `describe` block.

Replace every `expect(recorder.calls[0]?.cid).toBe(CID)` with `expect(recorder.calls[0]?.cid).toBe(actualCid)`.

In the test "stores AccessFnOutputs row after successful access fn evaluation", replace `expect(row.fnCid).toBe(CID)` with `expect(row.fnCid).toBe(actualCid)`.

In the test "named binding takes precedence over wildcard '*' fallback":
- Remove the manual wildcard insert (lines 232–239) — the extraction already created a `*` binding.
- The `"default"` dbName no longer has a named binding (access.js only has a default export), so this test needs adjustment. Replace the `"default"` dbName write with a fresh dbName that has no named binding — the wildcard `*` handles it:

```ts
  it("named export binding takes precedence over wildcard '*' fallback", async () => {
    // Push access.js with both a named export and a default export
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      appSlug,
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: `export function notes(doc) { return { allowAnonymous: true }; }\nexport default function(doc) { return { allowAnonymous: true }; }` },
      ],
    });
    assert(r.isOk(), "push with named+default failed");

    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    const bindings = await appCtx.vibesCtx.sql.db
      .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.userSlug, ownerHandle), eq(tAfb.appSlug, appSlug)));
    const namedCid = bindings.find((b) => b.dbName === "notes")?.accessFnCid;
    const wildcardCid = bindings.find((b) => b.dbName === "*")?.accessFnCid;
    assert(namedCid !== undefined, "named binding must exist");
    assert(wildcardCid !== undefined, "wildcard binding must exist");

    // Write to "notes" db — should use the named CID
    recorder.calls = [];
    recorder.result = { allowAnonymous: true };
    const r1 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "notes",
      doc: { title: "named binding" },
    });
    expect(r1.isOk()).toBe(true);
    expect(recorder.calls.length).toBe(1);
    expect(recorder.calls[0]?.cid).toBe(namedCid);

    // Write to "other-db" — no named binding, should fall back to wildcard
    recorder.calls = [];
    const r2 = await ownerApi.putDoc({
      ownerHandle,
      appSlug,
      dbName: "other-db",
      doc: { title: "wildcard fallback" },
    });
    expect(r2.isOk()).toBe(true);
    expect(recorder.calls.length).toBe(1);
    expect(recorder.calls[0]?.cid).toBe(wildcardCid);
  });
```

In the test "getDoc returns not-found for doc in inaccessible channel" (if it queries by `fnCid`), replace `eq(tOutputs.fnCid, CID)` with `eq(tOutputs.fnCid, actualCid)`.

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-invoke.test.ts`
Expected: 9 tests PASS

- [ ] **Step 3: Run full access-fn suite to check for regressions**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-backfill.test.ts vibes.diy/api/tests/access-fn-invoke.test.ts vibes.diy/api/tests/access-fn-channel-read.test.ts vibes.diy/api/tests/access-fn-filesystem.test.ts`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/tests/access-fn-invoke.test.ts
git commit -m "test: replace manual DB seeding with extraction-based setup in access-fn-invoke (#2188)"
```

---

### Task 8: Fix access-fn-channel-read.test.ts — extraction-based setup

**Files:**
- Modify: `vibes.diy/api/tests/access-fn-channel-read.test.ts`

- [ ] **Step 1: Replace manual DB seeding with access.js push**

Remove the `CID` constant.

Add an access.js constant:

```ts
const ACCESS_JS_CHAT = `export function chat(doc, oldDoc, user) {
  return { channels: ["general"], allowAnonymous: true };
}`;
```

Replace the `beforeAll` body. The key change: push `[App.jsx, access.js]` instead of `[App.jsx]` + manual insert. Read actual CID from the binding table after push:

```ts
  beforeAll(async () => {
    const { ctx, wsPair, sthis, deviceCA } = await setupCtx(recorder);
    appCtx = ctx;
    const ownerSetup = await mkUser(sthis, deviceCA, wsPair, 900);
    ownerApi = ownerSetup.api;
    const r = await ownerApi.ensureAppSlug({
      mode: "dev",
      fileSystem: [
        { type: "code-block", lang: "jsx", filename: "/App.jsx", content: `function App() { return null; } App();` },
        { type: "code-block", lang: "js", filename: "/access.js", content: ACCESS_JS_CHAT },
      ],
    });
    const res = r.Ok();
    if (!isResEnsureAppSlugOk(res)) assert.fail("Failed to create app");
    appSlug = res.appSlug;
    ownerHandle = res.ownerHandle;

    // Read actual CID from the binding the extraction logic created
    const tAfb = appCtx.vibesCtx.sql.tables.accessFunctionBindings;
    const bindings = await appCtx.vibesCtx.sql.db
      .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.userSlug, ownerHandle), eq(tAfb.appSlug, appSlug)));
    const chatBinding = bindings.find((b) => b.dbName === "chat");
    assert(chatBinding !== undefined, "extraction must create a 'chat' binding");
    actualCid = chatBinding.accessFnCid;

    // Write two docs through the access fn gate — one in "general", one in "secret"
    recorder.result = { channels: ["general"], allowAnonymous: true };
    const r1 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "public-msg" } });
    assert(r1.isOk(), "first putDoc failed");

    recorder.result = { channels: ["secret"], allowAnonymous: true };
    const r2 = await ownerApi.putDoc({ ownerHandle, appSlug, dbName: "chat", doc: { title: "secret-msg" } });
    assert(r2.isOk(), "second putDoc failed");

    // Seed a grant so the owner has "general" channel access
    const tOutputs = appCtx.vibesCtx.sql.tables.accessFnOutputs;
    await appCtx.vibesCtx.sql.db
      .insert(tOutputs)
      .values({
        userSlug: ownerHandle,
        appSlug,
        dbName: "chat",
        docId: "grant-doc",
        fnCid: actualCid,
        output: JSON.stringify({ grant: { users: { [ownerHandle]: ["general"] } } }),
        hasGrants: 1,
      })
      .onConflictDoUpdate({
        target: [tOutputs.userSlug, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
        set: {
          output: JSON.stringify({ grant: { users: { [ownerHandle]: ["general"] } } }),
          hasGrants: 1,
        },
      });

    recorder.calls = [];
    recorder.result = { channels: ["general"], allowAnonymous: true };
  }, 30000);
```

Add `let actualCid: string;` alongside the other `let` declarations.

In "getDoc returns not-found for doc in inaccessible channel", replace `eq(tOutputs.fnCid, CID)` with `eq(tOutputs.fnCid, actualCid)`.

- [ ] **Step 2: Run tests to verify all pass**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-channel-read.test.ts`
Expected: 3 tests PASS

- [ ] **Step 3: Run full access-fn suite**

Run: `npx vitest --run vibes.diy/api/tests/access-fn-backfill.test.ts vibes.diy/api/tests/access-fn-invoke.test.ts vibes.diy/api/tests/access-fn-channel-read.test.ts vibes.diy/api/tests/access-fn-filesystem.test.ts vibes.diy/api/tests/resolve-code-blocks.test.ts`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add vibes.diy/api/tests/access-fn-channel-read.test.ts
git commit -m "test: replace manual DB seeding with extraction-based setup in access-fn-channel-read (#2188)"
```

---

### Task 9: Final validation

- [ ] **Step 1: Run pnpm fast-check**

Run: `pnpm fast-check`
Expected: PASS (format + build + relevant tests + lint)

- [ ] **Step 2: Push**

```bash
git push
```
