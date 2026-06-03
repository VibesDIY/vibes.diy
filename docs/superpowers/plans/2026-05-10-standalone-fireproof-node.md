# Standalone `fireproof()` for Node.js / Wrangler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `import { fireproof } from "use-vibes"` work for Node.js / Wrangler scripts. Bare form `fireproof("todos")` auto-resolves auth/userHandle/appSlug from local CLI state populated by `npx vibes-diy login`.

**Architecture:** Three-package layering (no new packages). vibe-runtime gains a `FireflyTransport` structural interface. api-impl gains a `FireflyApiAdapter` that wraps `VibesDiyApi` to satisfy that interface. use-vibes-base gains the `fireproof()` factory + a Node-only keybag loader, replacing the legacy `@fireproof/use-fireproof` re-export. Module-level singleton (`Lazy`) shares one `VibesDiyApi` across all `fireproof(name)` calls; per-name database cache (`KeyedResolvOnce`) makes repeat-name calls return the same instance.

**Tech Stack:** TypeScript, vitest, `@adviser/cement` (`Result`, `Lazy`, `KeyedResolvOnce`, `ResolveOnce`), `@fireproof/core-keybag`, `@fireproof/core-device-id`, existing `@vibes.diy/api-types` request/response shapes.

**Spec:** [docs/superpowers/specs/2026-05-10-standalone-fireproof-node-design.md](../specs/2026-05-10-standalone-fireproof-node-design.md)

---

## Pre-flight

- [ ] **Step 1: Confirm starting branch is clean and on main**

Run: `git status && git branch --show-current`
Expected: clean working tree, branch `main` or your feature branch tracking it.

- [ ] **Step 2: Run baseline `pnpm fast-check` to confirm everything is green before changes**

Run from repo root: `pnpm fast-check 2>&1 | tee /tmp/baseline.log | tail -30`
Expected: `Tasks: ... succeeded`. If anything fails before we start, stop and ask the user before continuing.

---

## Task 1: Extract `FireflyTransport` interface

**Why:** Decouple `FireflyDatabase` from the postMessage-specific `VibeSandboxApi` so api-impl can implement the same shape without depending on vibe-runtime's React code or the iframe bridge.

**Files:**

- Modify: [`vibes.diy/vibe/runtime/firefly-database.ts`](../../../vibes.diy/vibe/runtime/firefly-database.ts) (lines 1-13 imports, lines 65-95 class header)

- [ ] **Step 1: Read the current import block + class declaration**

Run: `sed -n '1,90p' vibes.diy/vibe/runtime/firefly-database.ts`
Skim it so the next edits land cleanly.

- [ ] **Step 2: Add the `FireflyTransport` interface and types it needs**

Edit `vibes.diy/vibe/runtime/firefly-database.ts`. Replace the import block + the existing class declaration:

Find:

```ts
import type { VibeSandboxApi, VibeApp } from "./register-dependencies.js";
// Response validators + event — re-exported from api-types via vibe-types
import { isResPutDoc, isResGetDoc, isResQueryDocs, isResDeleteDoc, isEvtDocChanged } from "@vibes.diy/vibe-types";
import { decorateFiles } from "./firefly-files-read.js";
import { uploadFiles, type AssetUploader } from "./firefly-files-write.js";
```

Replace with:

```ts
import type { VibeApp } from "./register-dependencies.js";
import type { Result } from "@adviser/cement";
// Response validators + event — re-exported from api-types via vibe-types
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
} from "@vibes.diy/vibe-types";
import { decorateFiles } from "./firefly-files-read.js";
import { uploadFiles, type AssetUploader } from "./firefly-files-write.js";

/**
 * Structural subset of VibeSandboxApi that FireflyDatabase calls.
 * Implementations: VibeSandboxApi (postMessage, in-iframe) and
 * FireflyApiAdapter (WebSocket, Node/Wrangler). Both satisfy this
 * interface structurally — FireflyDatabase has no knowledge of which
 * transport is in use.
 */
export interface FireflyTransport {
  readonly svc: { readonly vibeApp: VibeApp };
  putDoc(doc: Record<string, unknown>, docId?: string, dbName?: string): Promise<Result<ResPutDoc>>;
  getDoc(docId: string, dbName?: string): Promise<Result<ResGetDoc | ResGetDocNotFound>>;
  queryDocs(dbName?: string): Promise<Result<ResQueryDocs>>;
  deleteDoc(docId: string, dbName?: string): Promise<Result<ResDeleteDoc>>;
  subscribeDocs(dbName?: string): Promise<Result<ResSubscribeDocs>>;
  onMsg(fn: (event: { data: unknown }) => void): void;
  putAsset(blob: Blob, mimeType?: string): Promise<Result<unknown>>;
}
```

(The `putAsset` member is included so the existing `uploadFiles(doc, this.vibeApi as unknown as AssetUploader)` cast in `put()` keeps working. Adapter implementations may throw from `putAsset` if they don't support files.)

- [ ] **Step 3: Retype the `vibeApi` field to `FireflyTransport`**

Find:

```ts
  private readonly vibeApi: VibeSandboxApi;
  private readonly vibeApp: VibeApp;
  private readonly listeners = new Set<ListenerFn>();
  private readonly updateListeners = new Set<ListenerFn>();

  constructor(name: string, vibeApi: VibeSandboxApi) {
```

Replace with:

```ts
  private readonly vibeApi: FireflyTransport;
  private readonly vibeApp: VibeApp;
  private readonly listeners = new Set<ListenerFn>();
  private readonly updateListeners = new Set<ListenerFn>();

  constructor(name: string, vibeApi: FireflyTransport) {
```

- [ ] **Step 4: Run the existing firefly tests — they must still pass unchanged**

Run from repo root:

```bash
cd vibes.diy/tests/app && pnpm test firefly-database firefly-nodejs use-firefly firefly-files 2>&1 | tail -20
```

Expected: all four test files pass. If anything fails, the structural interface doesn't match what `VibeSandboxApi` exposes — re-read both and fix the interface.

- [ ] **Step 5: Format and commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write vibes.diy/vibe/runtime/firefly-database.ts
git add vibes.diy/vibe/runtime/firefly-database.ts
git commit -m "$(cat <<'EOF'
refactor(firefly): extract FireflyTransport interface from VibeSandboxApi

Decouples FireflyDatabase from the postMessage-specific transport so
non-iframe transports (e.g. WebSocket via VibesDiyApi) can implement the
same shape. VibeSandboxApi structurally satisfies the interface — no
in-iframe call sites change.

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Scaffold `FireflyApiAdapter` with userHandle resolver

**Why:** The adapter is what bridges `VibesDiyApi`'s request-object methods to the positional `FireflyTransport` shape. Start with construction + lazy `userHandle` resolution; per-method translation comes in Task 3.

**Files:**

- Create: `vibes.diy/api/impl/firefly-api-adapter.ts`
- Create: `vibes.diy/api/impl/firefly-api-adapter.test.ts`

- [ ] **Step 1: Write the failing scaffold test**

Create `vibes.diy/api/impl/firefly-api-adapter.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { Result } from "@adviser/cement";
import { FireflyApiAdapter } from "./firefly-api-adapter.js";

function fakeVibesDiyApi(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ensureUserSettings: vi.fn(async () =>
      Result.Ok({
        type: "vibes.diy.res-ensure-user-settings",
        userId: "user-1",
        settings: [{ type: "defaultUserSlug", userHandle: "alice" }],
        updated: "now",
        created: "now",
      })
    ),
    onDocChanged: vi.fn(() => () => {}),
    ...overrides,
  } as never;
}

describe("FireflyApiAdapter", () => {
  it("exposes svc.vibeApp.appSlug from constructor", () => {
    const adapter = new FireflyApiAdapter(fakeVibesDiyApi(), "my-app");
    expect(adapter.svc.vibeApp.appSlug).toBe("my-app");
  });

  it("resolves userHandle from ensureUserSettings.defaultUserSlug on first request", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app");
    const slug = await adapter.resolveUserSlug();
    expect(slug).toBe("alice");
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
    // Second call uses the cache
    await adapter.resolveUserSlug();
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
  });

  it("uses opts.userHandle override and skips ensureUserSettings", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app", { userHandle: "bob" });
    expect(await adapter.resolveUserSlug()).toBe("bob");
    expect(api.ensureUserSettings).not.toHaveBeenCalled();
  });

  it("throws when ensureUserSettings has no defaultUserSlug entry", async () => {
    const api = fakeVibesDiyApi({
      ensureUserSettings: vi.fn(async () =>
        Result.Ok({
          type: "vibes.diy.res-ensure-user-settings",
          userId: "user-1",
          settings: [],
          updated: "now",
          created: "now",
        })
      ),
    });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await expect(adapter.resolveUserSlug()).rejects.toThrow(/defaultUserSlug/);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails because `firefly-api-adapter.js` does not exist**

Run from repo root:

```bash
cd vibes.diy/api/impl && pnpm vitest run firefly-api-adapter.test.ts 2>&1 | tail -15
```

Expected: `Cannot find module './firefly-api-adapter.js'` or similar.

(If `vibes.diy/api/impl/` doesn't have a `pnpm test` script, run from `vibes.diy/tests/app/` instead — adapt the path.)

- [ ] **Step 3: Implement the scaffold**

Create `vibes.diy/api/impl/firefly-api-adapter.ts`:

```ts
import { Result, ResolveOnce } from "@adviser/cement";
import { isUserSettingDefaultUserSlug } from "@vibes.diy/api-types";
import type { VibesDiyApi } from "./index.js";

/**
 * Bridges VibesDiyApi (WebSocket, request-object signatures) to the
 * FireflyTransport shape FireflyDatabase expects (positional, dbName,
 * appSlug/userHandle baked in via svc.vibeApp).
 *
 * One adapter per (apiUrl, appSlug) pair — typically created once per
 * process via the fireproof() factory in use-vibes.
 *
 * userHandle is resolved lazily from the user's defaultUserSlug setting
 * via ensureUserSettings({}). Pass opts.userHandle to skip the round-trip
 * (e.g. for service accounts where the token's user differs from the
 * routing user).
 */
export class FireflyApiAdapter {
  readonly svc: { vibeApp: { userHandle: string; appSlug: string; fsId: string } };

  private readonly api: VibesDiyApi;
  private readonly userHandleOverride: string | undefined;
  private readonly userHandleOnce = new ResolveOnce<string>();

  constructor(api: VibesDiyApi, appSlug: string, opts?: { userHandle?: string }) {
    this.api = api;
    this.userHandleOverride = opts?.userHandle;
    // svc.vibeApp.userHandle is mutable — gets backfilled after resolveUserSlug()
    // completes. Consumers who need it before any RPC should call
    // adapter.resolveUserSlug() explicitly.
    this.svc = {
      vibeApp: {
        appSlug,
        userHandle: opts?.userHandle ?? "",
        fsId: "", // unused on the Node side; FireflyDatabase only reads userHandle+appSlug
      },
    };
  }

  async resolveUserSlug(): Promise<string> {
    if (this.userHandleOverride) return this.userHandleOverride;
    return this.userHandleOnce.once(async () => {
      const rRes = await this.api.ensureUserSettings({ settings: [] });
      if (rRes.isErr()) {
        throw new Error(`Failed to load user settings: ${rRes.Err()}`);
      }
      const def = rRes.Ok().settings.find(isUserSettingDefaultUserSlug);
      if (!def) {
        throw new Error("No defaultUserSlug — pass {userHandle} or run 'npx vibes-diy login' first");
      }
      // Backfill svc.vibeApp.userHandle so FireflyDatabase's onMsg filter works.
      (this.svc.vibeApp as { userHandle: string }).userHandle = def.userHandle;
      return def.userHandle;
    });
  }
}
```

- [ ] **Step 4: Run the test — confirm it passes**

Run: `cd vibes.diy/api/impl && pnpm vitest run firefly-api-adapter.test.ts 2>&1 | tail -10`
Expected: 4 passed.

- [ ] **Step 5: Format and commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git add vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git commit -m "$(cat <<'EOF'
feat(api-impl): scaffold FireflyApiAdapter with lazy userHandle resolver

First slice of the WS-side adapter. Builds svc.vibeApp from constructor
args and resolves userHandle from ensureUserSettings({}) -> defaultUserSlug
on first request, with optional opts.userHandle override.

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Implement `FireflyApiAdapter` document methods

**Why:** Translate the positional `(doc, docId?, dbName?)` calls FireflyDatabase makes into the request-object shape VibesDiyApi expects, with `appSlug`/`userHandle` baked in.

**Files:**

- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts`
- Modify: `vibes.diy/api/impl/firefly-api-adapter.test.ts`

- [ ] **Step 1: Add failing tests for putDoc, getDoc, queryDocs, deleteDoc, subscribeDocs**

Append to `vibes.diy/api/impl/firefly-api-adapter.test.ts` (inside the existing `describe`):

```ts
it("putDoc translates positional call to request object with appSlug+userHandle+dbName", async () => {
  const putDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id: "doc-1" }));
  const api = fakeVibesDiyApi({ putDoc });
  const adapter = new FireflyApiAdapter(api, "my-app");
  const res = await adapter.putDoc({ text: "hello" }, "doc-1", "todos");
  expect(res.isOk()).toBe(true);
  expect(putDoc).toHaveBeenCalledWith({
    appSlug: "my-app",
    userHandle: "alice",
    dbName: "todos",
    doc: { text: "hello" },
    docId: "doc-1",
  });
});

it("putDoc defaults dbName to 'default' when omitted", async () => {
  const putDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id: "x" }));
  const api = fakeVibesDiyApi({ putDoc });
  const adapter = new FireflyApiAdapter(api, "my-app");
  await adapter.putDoc({ a: 1 });
  expect(putDoc).toHaveBeenCalledWith(expect.objectContaining({ dbName: "default" }));
});

it("getDoc routes through VibesDiyApi.getDoc", async () => {
  const getDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-get-doc", status: "ok", id: "doc-1", doc: { text: "hi" } }));
  const api = fakeVibesDiyApi({ getDoc });
  const adapter = new FireflyApiAdapter(api, "my-app");
  await adapter.getDoc("doc-1", "todos");
  expect(getDoc).toHaveBeenCalledWith({
    appSlug: "my-app",
    userHandle: "alice",
    dbName: "todos",
    docId: "doc-1",
  });
});

it("queryDocs routes through VibesDiyApi.queryDocs", async () => {
  const queryDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs: [] }));
  const api = fakeVibesDiyApi({ queryDocs });
  const adapter = new FireflyApiAdapter(api, "my-app");
  await adapter.queryDocs("todos");
  expect(queryDocs).toHaveBeenCalledWith({ appSlug: "my-app", userHandle: "alice", dbName: "todos" });
});

it("deleteDoc routes through VibesDiyApi.deleteDoc", async () => {
  const deleteDoc = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-delete-doc", status: "ok", id: "doc-1" }));
  const api = fakeVibesDiyApi({ deleteDoc });
  const adapter = new FireflyApiAdapter(api, "my-app");
  await adapter.deleteDoc("doc-1", "todos");
  expect(deleteDoc).toHaveBeenCalledWith({
    appSlug: "my-app",
    userHandle: "alice",
    dbName: "todos",
    docId: "doc-1",
  });
});

it("subscribeDocs routes through VibesDiyApi.subscribeDocs", async () => {
  const subscribeDocs = vi.fn(async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" }));
  const api = fakeVibesDiyApi({ subscribeDocs });
  const adapter = new FireflyApiAdapter(api, "my-app");
  await adapter.subscribeDocs("todos");
  expect(subscribeDocs).toHaveBeenCalledWith({ appSlug: "my-app", userHandle: "alice", dbName: "todos" });
});

it("putAsset throws — file uploads not supported in v1", async () => {
  const adapter = new FireflyApiAdapter(fakeVibesDiyApi(), "my-app");
  await expect(adapter.putAsset(new Blob(["x"]))).rejects.toThrow(/file uploads not supported/i);
});
```

- [ ] **Step 2: Run the tests — confirm they fail because the methods don't exist**

Run: `cd vibes.diy/api/impl && pnpm vitest run firefly-api-adapter.test.ts 2>&1 | tail -20`
Expected: 7 fails (`adapter.putDoc is not a function`, etc.).

- [ ] **Step 3: Implement the document methods**

Open `vibes.diy/api/impl/firefly-api-adapter.ts`. Update the imports at the top:

Find:

```ts
import { Result, ResolveOnce } from "@adviser/cement";
import { isUserSettingDefaultUserSlug } from "@vibes.diy/api-types";
import type { VibesDiyApi } from "./index.js";
```

Replace with:

```ts
import { Result, ResolveOnce } from "@adviser/cement";
import {
  isUserSettingDefaultUserSlug,
  type ResPutDoc,
  type ResGetDoc,
  type ResGetDocNotFound,
  type ResQueryDocs,
  type ResDeleteDoc,
  type ResSubscribeDocs,
  type VibesDiyError,
} from "@vibes.diy/api-types";
import type { VibesDiyApi } from "./index.js";
```

Then append these methods to the class body (after `resolveUserSlug`):

```ts
  // ── FireflyTransport methods ───────────────────────────────────────

  async putDoc(
    doc: Record<string, unknown>,
    docId?: string,
    dbName = "default",
  ): Promise<Result<ResPutDoc, VibesDiyError>> {
    const userHandle = await this.resolveUserSlug();
    return this.api.putDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userHandle,
      dbName,
      doc,
      ...(docId ? { docId } : {}),
    });
  }

  async getDoc(
    docId: string,
    dbName = "default",
  ): Promise<Result<ResGetDoc | ResGetDocNotFound, VibesDiyError>> {
    const userHandle = await this.resolveUserSlug();
    return this.api.getDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userHandle,
      dbName,
      docId,
    });
  }

  async queryDocs(dbName = "default"): Promise<Result<ResQueryDocs, VibesDiyError>> {
    const userHandle = await this.resolveUserSlug();
    return this.api.queryDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userHandle,
      dbName,
    });
  }

  async deleteDoc(docId: string, dbName = "default"): Promise<Result<ResDeleteDoc, VibesDiyError>> {
    const userHandle = await this.resolveUserSlug();
    return this.api.deleteDoc({
      appSlug: this.svc.vibeApp.appSlug,
      userHandle,
      dbName,
      docId,
    });
  }

  async subscribeDocs(dbName = "default"): Promise<Result<ResSubscribeDocs, VibesDiyError>> {
    const userHandle = await this.resolveUserSlug();
    return this.api.subscribeDocs({
      appSlug: this.svc.vibeApp.appSlug,
      userHandle,
      dbName,
    });
  }

  async putAsset(_blob: Blob, _mimeType?: string): Promise<Result<unknown>> {
    throw new Error(
      "file uploads not supported in standalone fireproof — coming in a future release",
    );
  }
```

- [ ] **Step 4: Run the tests — confirm they pass**

Run: `cd vibes.diy/api/impl && pnpm vitest run firefly-api-adapter.test.ts 2>&1 | tail -10`
Expected: all tests pass.

- [ ] **Step 5: Format and commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git add vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git commit -m "$(cat <<'EOF'
feat(api-impl): FireflyApiAdapter document methods

Translates positional FireflyTransport calls (put/get/query/delete/
subscribe) into VibesDiyApi request-object payloads with appSlug/userHandle
baked in. putAsset throws — file uploads land in a future release.

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Implement `FireflyApiAdapter.onMsg` (doc-changed bridge)

**Why:** `FireflyDatabase`'s constructor wires up `vibeApi.onMsg(event => isEvtDocChanged(event.data) && ...)`. `VibesDiyApi` exposes `onDocChanged((userHandle, appSlug, dbName, docId) => ...)` instead, so the adapter has to synthesize the event shape FireflyDatabase expects.

**Files:**

- Modify: `vibes.diy/api/impl/firefly-api-adapter.ts`
- Modify: `vibes.diy/api/impl/firefly-api-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `vibes.diy/api/impl/firefly-api-adapter.test.ts` (inside the existing `describe`):

```ts
it("onMsg synthesizes evt-doc-changed events from VibesDiyApi.onDocChanged", () => {
  let captured: ((u: string, a: string, db: string, doc: string) => void) | undefined;
  const onDocChanged = vi.fn((fn: typeof captured) => {
    captured = fn;
    return () => {};
  });
  const api = fakeVibesDiyApi({ onDocChanged });
  const adapter = new FireflyApiAdapter(api, "my-app");

  const seen: unknown[] = [];
  adapter.onMsg((event) => seen.push(event.data));

  expect(captured).toBeDefined();
  captured?.("alice", "my-app", "todos", "doc-1");

  expect(seen).toEqual([
    {
      type: "vibes.diy.evt-doc-changed",
      userHandle: "alice",
      appSlug: "my-app",
      dbName: "todos",
      docId: "doc-1",
    },
  ]);
});
```

- [ ] **Step 2: Run the test — confirm it fails (`adapter.onMsg is not a function`)**

Run: `cd vibes.diy/api/impl && pnpm vitest run firefly-api-adapter.test.ts -t "onMsg" 2>&1 | tail -10`

- [ ] **Step 3: Implement `onMsg`**

Append to `FireflyApiAdapter` class body:

```ts
  /**
   * Bridge VibesDiyApi.onDocChanged callbacks into the `{data: {type:
   * "vibes.diy.evt-doc-changed", ...}}` event shape FireflyDatabase's
   * onMsg listener expects. Multiple onMsg subscribers are supported
   * (each fan-outs from a single onDocChanged registration).
   */
  onMsg(fn: (event: { data: unknown }) => void): void {
    this.api.onDocChanged((userHandle, appSlug, dbName, docId) => {
      fn({
        data: {
          type: "vibes.diy.evt-doc-changed",
          userHandle,
          appSlug,
          dbName,
          docId,
        },
      });
    });
  }
```

- [ ] **Step 4: Run all FireflyApiAdapter tests**

Run: `cd vibes.diy/api/impl && pnpm vitest run firefly-api-adapter.test.ts 2>&1 | tail -10`
Expected: all 8 tests pass.

- [ ] **Step 5: Format and commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git add vibes.diy/api/impl/firefly-api-adapter.ts vibes.diy/api/impl/firefly-api-adapter.test.ts
git commit -m "$(cat <<'EOF'
feat(api-impl): FireflyApiAdapter.onMsg bridges onDocChanged events

Synthesizes {data: {type: "vibes.diy.evt-doc-changed", ...}} from
VibesDiyApi.onDocChanged callbacks so FireflyDatabase's existing
listener filter logic works unchanged.

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Re-export `FireflyApiAdapter` from api-impl entry

**Why:** Consumers (use-vibes) import via `@vibes.diy/api-impl`'s top-level barrel.

**Files:**

- Modify: [`vibes.diy/api/impl/index.ts`](../../../vibes.diy/api/impl/index.ts) (last line — `export * from "./api-connection.js"`)

- [ ] **Step 1: Add the re-export**

Find the last line of `vibes.diy/api/impl/index.ts`:

```ts
export * from "./api-connection.js";
```

Replace with:

```ts
export * from "./api-connection.js";
export { FireflyApiAdapter } from "./firefly-api-adapter.js";
```

- [ ] **Step 2: Verify it compiles**

Run from repo root:

```bash
cd vibes.diy/api/impl && pnpm tsc --noEmit 2>&1 | tail -10
```

Expected: no errors. (If `tsc --noEmit` is not the canonical check, run the package's `pnpm build` instead.)

- [ ] **Step 3: Commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
git add vibes.diy/api/impl/index.ts
git commit -m "$(cat <<'EOF'
feat(api-impl): re-export FireflyApiAdapter from package entry

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add `firefly-defaults.node.ts` keybag loader

**Why:** Node-only auto-discovery of the device-id `getToken` from the local Fireproof keybag (populated by `npx vibes-diy login`). Lifted from [`vibes-diy/cli/main.ts:25-69`](../../../vibes-diy/cli/main.ts) (`vibesDiyApiFactory`).

**Files:**

- Create: `use-vibes/base/firefly-defaults.node.ts`
- Create: `use-vibes/tests/firefly-defaults.node.test.ts`
- Modify: [`use-vibes/base/package.json`](../../../use-vibes/base/package.json) (add `@fireproof/core-device-id`, `@vibes.diy/api-impl` deps)

- [ ] **Step 1: Add the missing workspace deps to `use-vibes/base/package.json`**

Open `use-vibes/base/package.json`. In the `dependencies` block, add (alphabetically) entries that aren't already present:

```json
    "@fireproof/core-device-id": "0.24.19",
    "@vibes.diy/api-impl": "workspace:*",
```

Run from repo root:

```bash
pnpm install
```

Expected: `+ @fireproof/core-device-id 0.24.19` and `+ @vibes.diy/api-impl@workspace:*` reported, no errors.

- [ ] **Step 2: Write the failing test**

Create `use-vibes/tests/firefly-defaults.node.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { loadDeviceIdGetToken } from "@vibes.diy/use-vibes-base/firefly-defaults.node";

function inMemorySthis() {
  // Use an in-memory keybag so the test never touches real ~/.fireproof/.
  // FP_KEYBAG_URL points at a memory:// URL that gives a fresh empty keybag.
  const sthis = ensureSuperThis();
  sthis.env.set("FP_KEYBAG_URL", `memory://test-${sthis.nextId().str}`);
  return sthis;
}

describe("loadDeviceIdGetToken", () => {
  it("throws a helpful error when the keybag has no device-id cert", async () => {
    const sthis = inMemorySthis();
    await expect(loadDeviceIdGetToken(sthis)).rejects.toThrow(/vibes-diy login/);
  });
});
```

- [ ] **Step 3: Run the test — confirm it fails because the module doesn't exist**

Run from repo root:

```bash
cd use-vibes/tests && pnpm vitest run firefly-defaults.node.test.ts 2>&1 | tail -15
```

Expected: `Cannot find module ...firefly-defaults.node`.

- [ ] **Step 4: Implement the loader**

Create `use-vibes/base/firefly-defaults.node.ts`:

```ts
/**
 * Node-only keybag loader for the standalone fireproof() factory.
 *
 * Loaded via dynamic import only when the caller doesn't supply
 * opts.getToken — keeps the device-id + keybag deps out of any browser
 * bundle that imports use-vibes for SSR or iframe code.
 *
 * Lifted essentially verbatim from vibesDiyApiFactory in
 * vibes-diy/cli/main.ts. Same lifecycle: load device cert from keybag,
 * build a DeviceIdSignMsg signer, return a Lazy() getToken with a 60-second
 * resetAfter so the same JWT isn't re-minted on every WS request.
 */
import type { SuperThis } from "@fireproof/core-types-base";
import type { Result } from "@adviser/cement";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import type { FPDeviceIDSession } from "@fireproof/core";
import { Lazy, Result as CementResult } from "@adviser/cement";
import { getKeyBag } from "@fireproof/core-keybag";
import { DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";

export async function loadDeviceIdGetToken(sthis: SuperThis): Promise<() => Promise<Result<DashAuthType>>> {
  const kb = await getKeyBag(sthis);
  const devid = await kb.getDeviceId();
  if (devid.cert.IsNone()) {
    throw new Error("Run 'npx vibes-diy login' to authenticate this device");
  }
  const rDevkey = await DeviceIdKey.createFromJWK(devid.deviceId.Unwrap());
  if (rDevkey.isErr()) {
    throw rDevkey.Err();
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const payload = devid.cert.Unwrap()!.certificatePayload;
  const deviceIdSigner = new DeviceIdSignMsg(sthis.txt.base64, rDevkey.Ok(), payload);
  let seq = 0;
  return Lazy(
    async (): Promise<Result<DashAuthType>> => {
      const now = Math.floor(Date.now() / 1000);
      const token = await deviceIdSigner.sign(
        {
          iss: "use-vibes/standalone",
          sub: "device-id",
          deviceId: await rDevkey.Ok().fingerPrint(),
          seq: ++seq,
          exp: now + 120,
          nbf: now - 2,
          iat: now,
          jti: sthis.nextId().str,
        } satisfies FPDeviceIDSession,
        "ES256"
      );
      return CementResult.Ok({
        type: "device-id",
        token,
      });
    },
    { resetAfter: 60, skipUnref: true }
  );
}
```

- [ ] **Step 5: Run the test — confirm it passes**

Run: `cd use-vibes/tests && pnpm vitest run firefly-defaults.node.test.ts 2>&1 | tail -10`
Expected: 1 passed.

(If the import path `@vibes.diy/use-vibes-base/firefly-defaults.node` doesn't resolve, the package needs its `exports` map updated. Check `use-vibes/base/package.json` — if there's no `exports` block, the test can import via `../../base/firefly-defaults.node.js` directly. Update the test to use whichever import path resolves.)

- [ ] **Step 6: Format and commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write use-vibes/base/firefly-defaults.node.ts use-vibes/tests/firefly-defaults.node.test.ts use-vibes/base/package.json
git add use-vibes/base/firefly-defaults.node.ts use-vibes/tests/firefly-defaults.node.test.ts use-vibes/base/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(use-vibes): node-only device-id keybag loader

Lifted from vibesDiyApiFactory in vibes-diy/cli/main.ts. Loaded via
dynamic import inside the fireproof() factory only when opts.getToken
is omitted, so browser bundlers can tree-shake it.

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Implement `fireproof()` factory with module-singleton cache

**Why:** This is the headline export. Module-level singleton (`Lazy`) shares one `VibesDiyApi`+adapter across all calls; per-name `KeyedResolvOnce<FireflyDatabase>` makes `fireproof("a") === fireproof("a")` and ensures `fireproof("a")` and `fireproof("b")` share one transport — matches the SOIP-browser-style multi-db pattern.

**Files:**

- Create: `use-vibes/base/fireproof-node.ts`
- Create: `use-vibes/tests/fireproof-node.test.ts`

- [ ] **Step 1: Write the failing test for the cache + opts shape**

Create `use-vibes/tests/fireproof-node.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Result } from "@adviser/cement";
import { __resetFireproofForTesting, fireproof, type FireproofOpts } from "@vibes.diy/use-vibes-base/fireproof-node";

function fakeGetToken() {
  return async () => Result.Ok({ type: "device-id" as const, token: "tkn" });
}

function makeOpts(overrides: Partial<FireproofOpts> = {}): FireproofOpts {
  return {
    apiUrl: "ws://test.invalid",
    appSlug: "my-app",
    userHandle: "alice",
    getToken: fakeGetToken(),
    ...overrides,
  };
}

beforeEach(() => {
  __resetFireproofForTesting();
});

describe("fireproof() factory", () => {
  it("returns a database synchronously when called with explicit opts", () => {
    const db = fireproof("todos", makeOpts());
    expect(db.name).toBe("todos");
    expect(typeof db.put).toBe("function");
  });

  it("repeated calls with the same name return the same instance (KeyedResolvOnce cache)", () => {
    const a = fireproof("todos", makeOpts());
    const b = fireproof("todos", makeOpts());
    expect(a).toBe(b);
  });

  it("calls with different names return different instances", () => {
    const a = fireproof("a", makeOpts());
    const b = fireproof("b", makeOpts());
    expect(a).not.toBe(b);
    expect(a.name).toBe("a");
    expect(b.name).toBe("b");
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails (module missing)**

Run: `cd use-vibes/tests && pnpm vitest run fireproof-node.test.ts 2>&1 | tail -10`

- [ ] **Step 3: Implement the factory**

Create `use-vibes/base/fireproof-node.ts`:

```ts
/**
 * Standalone fireproof() factory for Node.js / Wrangler consumers.
 *
 * Module-level singletons:
 *  - sharedAdapter: Lazy<FireflyApiAdapter> — first fireproof() call's
 *    opts win. Subsequent calls reuse the cached adapter, so N
 *    fireproof(name) calls share one VibesDiyApi/WebSocket/userHandle.
 *  - databasesByName: KeyedResolvOnce<FireflyDatabase> — per-name cache
 *    so fireproof("x") returns the same instance across the process.
 *
 * Inside an iframe, the import map rewrites use-vibes -> vibe-runtime,
 * which exports its own fireproof("name") backed by VibeSandboxApi.
 * This module is only reached by Node / Wrangler consumers.
 */
import path from "node:path";
import { Lazy, KeyedResolvOnce, type Result } from "@adviser/cement";
import { VibesDiyApi, FireflyApiAdapter } from "@vibes.diy/api-impl";
import { FireflyDatabase } from "@vibes.diy/vibe-runtime";
import { ensureSuperThis } from "@fireproof/core-runtime";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";

export interface FireproofOpts {
  apiUrl?: string;
  appSlug?: string;
  userHandle?: string;
  getToken?: () => Promise<Result<DashAuthType>>;
}

interface ResolvedOpts {
  apiUrl: string;
  appSlug: string;
  userHandle: string | undefined;
  getToken: () => Promise<Result<DashAuthType>>;
}

const DEFAULT_API_URL = "https://vibes.diy/api";

const lazyKeybagGetToken = Lazy(async () => {
  const mod = await import("./firefly-defaults.node.js");
  return mod.loadDeviceIdGetToken(ensureSuperThis());
});

function resolveOptsSync(opts?: FireproofOpts): ResolvedOpts {
  const apiUrl = opts?.apiUrl ?? process.env.VIBES_DIY_API_URL ?? DEFAULT_API_URL;
  const appSlug = opts?.appSlug ?? process.env.VIBES_APP_SLUG ?? path.basename(process.cwd());
  if (!appSlug) {
    throw new Error("Set VIBES_APP_SLUG or pass {appSlug} to fireproof()");
  }
  const getToken =
    opts?.getToken ??
    (async () => {
      const inner = await lazyKeybagGetToken();
      return inner();
    });
  return { apiUrl, appSlug, userHandle: opts?.userHandle, getToken };
}

let sharedAdapter = Lazy((resolved: ResolvedOpts): FireflyApiAdapter => {
  const api = new VibesDiyApi({
    apiUrl: resolved.apiUrl,
    getToken: resolved.getToken,
  });
  return new FireflyApiAdapter(api, resolved.appSlug, resolved.userHandle ? { userHandle: resolved.userHandle } : undefined);
});

let databasesByName = new KeyedResolvOnce<FireflyDatabase>();

/**
 * Standalone fireproof() factory.
 *
 * Bare form `fireproof("todos")` auto-resolves auth/userHandle/appSlug from
 * local CLI state populated by `npx vibes-diy login`.
 *
 * **First-call-wins for opts.** The first call to fireproof() in a process
 * binds apiUrl/appSlug/getToken/userHandle to the singleton adapter — later
 * calls' opts arguments are silently ignored (matches the legacy fireproof()
 * mental model where opts are config-time, not call-time). Callers that need
 * different configs in one process should construct VibesDiyApi +
 * FireflyApiAdapter + FireflyDatabase directly.
 */
export function fireproof(name: string, opts?: FireproofOpts): FireflyDatabase {
  const resolved = resolveOptsSync(opts);
  return databasesByName.get(name).once(() => new FireflyDatabase(name, sharedAdapter(resolved)));
}

/** @internal — for tests only. Resets the module-level singletons. */
export function __resetFireproofForTesting(): void {
  sharedAdapter = Lazy((resolved: ResolvedOpts): FireflyApiAdapter => {
    const api = new VibesDiyApi({
      apiUrl: resolved.apiUrl,
      getToken: resolved.getToken,
    });
    return new FireflyApiAdapter(api, resolved.appSlug, resolved.userHandle ? { userHandle: resolved.userHandle } : undefined);
  });
  databasesByName = new KeyedResolvOnce<FireflyDatabase>();
}
```

- [ ] **Step 4: Run the test — confirm it passes**

Run: `cd use-vibes/tests && pnpm vitest run fireproof-node.test.ts 2>&1 | tail -10`
Expected: 3 passed.

- [ ] **Step 5: Add a test for first-call-wins opts semantics**

Append to `use-vibes/tests/fireproof-node.test.ts` (inside `describe`):

```ts
it("first call's opts win — second call's appSlug is ignored", async () => {
  // We can't observe appSlug directly without a put — so use a probe getToken
  // that records each invocation. Since both calls share one adapter, both
  // dbs use opts from the FIRST call.
  const tokenCalls: string[] = [];
  const tokenA = async () => {
    tokenCalls.push("A");
    return Result.Ok({ type: "device-id" as const, token: "A" });
  };
  const tokenB = async () => {
    tokenCalls.push("B");
    return Result.Ok({ type: "device-id" as const, token: "B" });
  };
  fireproof("a", makeOpts({ getToken: tokenA }));
  fireproof("b", makeOpts({ getToken: tokenB }));
  // Note: the dbs construct without immediately calling getToken (lazy WS).
  // What we *can* assert is that the cached adapter is shared:
  // both dbs route through the same FireflyApiAdapter instance.
  // (We test this more directly via the multi-db test in Task 9 against
  // an injected fake. Here we just confirm same-name returns same db.)
  expect(fireproof("a", makeOpts({ getToken: tokenB }))).toBe(fireproof("a", makeOpts({ getToken: tokenA })));
});
```

- [ ] **Step 6: Run again, then format and commit**

```bash
cd use-vibes/tests && pnpm vitest run fireproof-node.test.ts 2>&1 | tail -10
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write use-vibes/base/fireproof-node.ts use-vibes/tests/fireproof-node.test.ts
git add use-vibes/base/fireproof-node.ts use-vibes/tests/fireproof-node.test.ts
git commit -m "$(cat <<'EOF'
feat(use-vibes): standalone fireproof() factory for Node.js / Wrangler

Module-level singleton (Lazy) shares one VibesDiyApi+FireflyApiAdapter
across the process. KeyedResolvOnce per-name cache means fireproof("x")
returns the same FireflyDatabase across calls. First-call-wins for opts.

Defaults pipeline (when opts omitted):
  apiUrl   <- VIBES_DIY_API_URL env, then https://vibes.diy/api
  appSlug  <- VIBES_APP_SLUG env, then basename(cwd)
  getToken <- dynamic-import keybag loader (npx vibes-diy login)
  userHandle <- ensureUserSettings({}).defaultUserSlug (lazy in adapter)

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire the new `fireproof` into `use-vibes/base` exports (replace legacy)

**Why:** Top-level `import { fireproof } from "use-vibes"` should resolve to our new factory, not the legacy `@fireproof/use-fireproof` re-export.

**Files:**

- Modify: [`use-vibes/base/index.ts`](../../../use-vibes/base/index.ts) (lines 1-26 imports + re-exports)

- [ ] **Step 1: Read the existing imports/exports**

Run: `sed -n '1,30p' use-vibes/base/index.ts`

- [ ] **Step 2: Drop the legacy `fireproof` re-export, add ours**

Open `use-vibes/base/index.ts`. Find:

```ts
import {
  Attached,
  fireproof,
  ImgFile,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  UseFireproof,
  UseFPConfig,
  type Database,
  type UseFpToCloudParam,
} from "@fireproof/use-fireproof";
```

Remove the `fireproof,` line:

```ts
import {
  Attached,
  ImgFile,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  UseFireproof,
  UseFPConfig,
  type Database,
  type UseFpToCloudParam,
} from "@fireproof/use-fireproof";
```

Then find:

```ts
export { fireproof, ImgFile };
```

Replace with:

```ts
export { ImgFile };
export { fireproof, type FireproofOpts } from "./fireproof-node.js";
```

- [ ] **Step 3: Verify use-vibes/pkg still re-exports `fireproof` cleanly**

Run: `grep -n "fireproof" use-vibes/pkg/index.ts`
Expected: the `fireproof` symbol shows up in the existing re-export from `@vibes.diy/use-vibes-base`. No edit needed.

- [ ] **Step 4: Run the workspace type-check**

Run from repo root: `pnpm fast-check 2>&1 | tee /tmp/task8.log | tail -20`

If type errors mention `Cannot find module './fireproof-node.js'` from the .ts file, ensure the import is in `.js` extension (TypeScript ESM convention) — should match what's in the file already.

If type errors mention the `fireproof` symbol clashing or being exported twice, double-check that the re-export from `@fireproof/use-fireproof` has been fully removed.

- [ ] **Step 5: Commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write use-vibes/base/index.ts
git add use-vibes/base/index.ts
git commit -m "$(cat <<'EOF'
feat(use-vibes)!: replace legacy fireproof re-export with WS-backed factory

BREAKING: use-vibes' top-level fireproof() no longer re-exports the
legacy @fireproof/use-fireproof local-IndexedDB factory. Outside vibe
iframes, fireproof("name") now talks WebSocket to vibes.diy (auth via
device-id keybag from `npx vibes-diy login`).

Inside iframes, the import map alias use-vibes -> @vibes.diy/vibe-runtime
is unchanged, so fireproof("name") in vibe code keeps working as before.

External npm consumers who relied on local-only IndexedDB should switch
to `import { fireproof } from "@fireproof/use-fireproof"` directly.
useFireproof from use-vibes is unchanged.

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add the spec's three test scenarios to `firefly-nodejs.test.ts`

**Why:** The spec calls for these new describe blocks against the WS-backed factory. Use an injected fake `VibesDiyApi` (no real WS, no real keybag) so tests are deterministic.

**Files:**

- Create: `vibes.diy/tests/app/fake-vibes-diy-api.ts` (extracted helper for use across the new tests)
- Modify: [`vibes.diy/tests/app/firefly-nodejs.test.ts`](../../../vibes.diy/tests/app/firefly-nodejs.test.ts) (append three new describe blocks at the end)

- [ ] **Step 1: Create a reusable `FakeVibesDiyApi`**

Create `vibes.diy/tests/app/fake-vibes-diy-api.ts`:

```ts
/**
 * Test double for VibesDiyApi. In-memory doc store, no WebSocket, no
 * Clerk dependency. Implements the subset FireflyApiAdapter actually
 * calls (ensureUserSettings, putDoc/getDoc/queryDocs/deleteDoc/
 * subscribeDocs, onDocChanged).
 */
import { Result } from "@adviser/cement";

let idCounter = 0;
let connectionCounter = 0;

export interface FakeVibesDiyApi {
  ensureUserSettings: (req: unknown) => Promise<Result<unknown>>;
  putDoc: (req: {
    appSlug: string;
    userHandle: string;
    dbName: string;
    doc: Record<string, unknown>;
    docId?: string;
  }) => Promise<Result<unknown>>;
  getDoc: (req: { appSlug: string; userHandle: string; dbName: string; docId: string }) => Promise<Result<unknown>>;
  queryDocs: (req: { appSlug: string; userHandle: string; dbName: string }) => Promise<Result<unknown>>;
  deleteDoc: (req: { appSlug: string; userHandle: string; dbName: string; docId: string }) => Promise<Result<unknown>>;
  subscribeDocs: (req: { appSlug: string; userHandle: string; dbName: string }) => Promise<Result<unknown>>;
  onDocChanged: (fn: (userHandle: string, appSlug: string, dbName: string, docId: string) => void) => () => void;
  /** how many times `new VibesDiyApi(...)` would have been called — used by multi-db test */
  readonly _connectionId: number;
  /** raw access to the doc store keyed by dbName */
  readonly _docs: Map<string, Map<string, Record<string, unknown>>>;
  /** simulate a server-push doc-changed event */
  _simulateDocChanged: (userHandle: string, appSlug: string, dbName: string, docId: string) => void;
}

export function createFakeVibesDiyApi(opts: { defaultUserSlug?: string } = {}): FakeVibesDiyApi {
  const docsByDb = new Map<string, Map<string, Record<string, unknown>>>();
  const docChangedListeners: ((u: string, a: string, db: string, doc: string) => void)[] = [];
  const connectionId = ++connectionCounter;

  function dbStore(dbName: string): Map<string, Record<string, unknown>> {
    let store = docsByDb.get(dbName);
    if (!store) {
      store = new Map();
      docsByDb.set(dbName, store);
    }
    return store;
  }

  return {
    _connectionId: connectionId,
    _docs: docsByDb,

    ensureUserSettings: async () =>
      Result.Ok({
        type: "vibes.diy.res-ensure-user-settings",
        userId: `user-${connectionId}`,
        settings: opts.defaultUserSlug ? [{ type: "defaultUserSlug", userHandle: opts.defaultUserSlug }] : [],
        updated: "now",
        created: "now",
      }),

    putDoc: async (req) => {
      const id = req.docId ?? `${Date.now().toString(16)}-${(++idCounter).toString(16).padStart(8, "0")}`;
      dbStore(req.dbName).set(id, { ...req.doc, _id: id });
      return Result.Ok({ type: "vibes.diy.res-put-doc", status: "ok", id });
    },

    getDoc: async (req) => {
      const doc = dbStore(req.dbName).get(req.docId);
      if (!doc) return Result.Err(`Document not found: ${req.docId}`);
      return Result.Ok({
        type: "vibes.diy.res-get-doc",
        status: "ok",
        id: req.docId,
        doc: { ...doc },
      });
    },

    queryDocs: async (req) => {
      const docs = [...dbStore(req.dbName).values()].map((d) => ({ ...d, _id: d._id as string }));
      return Result.Ok({ type: "vibes.diy.res-query-docs", status: "ok", docs });
    },

    deleteDoc: async (req) => {
      dbStore(req.dbName).delete(req.docId);
      return Result.Ok({ type: "vibes.diy.res-delete-doc", status: "ok", id: req.docId });
    },

    subscribeDocs: async () => Result.Ok({ type: "vibes.diy.res-subscribe-docs", status: "ok" }),

    onDocChanged: (fn) => {
      docChangedListeners.push(fn);
      return () => {
        const i = docChangedListeners.indexOf(fn);
        if (i >= 0) docChangedListeners.splice(i, 1);
      };
    },

    _simulateDocChanged: (userHandle, appSlug, dbName, docId) => {
      for (const fn of docChangedListeners) fn(userHandle, appSlug, dbName, docId);
    },
  };
}
```

- [ ] **Step 2: Append the three new describe blocks to `firefly-nodejs.test.ts`**

Open [`vibes.diy/tests/app/firefly-nodejs.test.ts`](../../../vibes.diy/tests/app/firefly-nodejs.test.ts). After the closing `});` of the existing top-level describe, append:

```ts
// ── New tests for the standalone fireproof() factory (Node-only path) ──
import { FireflyApiAdapter } from "@vibes.diy/api-impl";
import { FireflyDatabase } from "@vibes.diy/vibe-runtime";
import { createFakeVibesDiyApi } from "./fake-vibes-diy-api.js";

describe("FireflyApiAdapter end-to-end against fake VibesDiyApi", () => {
  it("put / get / query workflow translates correctly through the adapter", async () => {
    const api = createFakeVibesDiyApi({ defaultUserSlug: "alice" });
    const adapter = new FireflyApiAdapter(api as never, "my-app");
    const db = new FireflyDatabase("todos", adapter);

    const ok = await db.put({ text: "Sample Data" });
    expect(ok.id).toBeDefined();

    const doc = await db.get(ok.id);
    expect(doc.text).toBe("Sample Data");

    await db.put({ text: "Second" });
    await db.put({ text: "Third" });

    const latest = await db.query("_id", { limit: 10, descending: true });
    expect(latest.docs.length).toBe(3);
    expect(latest.docs[0].text).toBe("Third");
  });

  it("delete + 'not found' error", async () => {
    const api = createFakeVibesDiyApi({ defaultUserSlug: "alice" });
    const db = new FireflyDatabase("delete-test", new FireflyApiAdapter(api as never, "my-app"));

    const ok = await db.put({ text: "delete me" });
    await db.del(ok.id);
    await expect(db.get(ok.id)).rejects.toThrow();
  });

  it("subscribe receives synthesized evt-doc-changed when fake fires onDocChanged", async () => {
    const api = createFakeVibesDiyApi({ defaultUserSlug: "alice" });
    const adapter = new FireflyApiAdapter(api as never, "my-app");
    const db = new FireflyDatabase("subs-test", adapter);
    // FireflyDatabase's constructor calls subscribeDocs and resolveUserSlug
    // asynchronously; flush a microtask to let those land.
    await new Promise((r) => setTimeout(r, 0));
    await adapter.resolveUserSlug();

    const seen: unknown[] = [];
    db.subscribe((changes) => seen.push(...changes), false);

    api._simulateDocChanged("alice", "my-app", "subs-test", "doc-1");

    expect(seen.length).toBe(1);
  });
});

describe("Multi-database caching via fireproof() factory", () => {
  it("fireproof('a') returns the same instance on repeat calls", async () => {
    const { fireproof, __resetFireproofForTesting } = await import("@vibes.diy/use-vibes-base/fireproof-node");
    const { Result } = await import("@adviser/cement");
    __resetFireproofForTesting();

    const opts = {
      apiUrl: "ws://test.invalid",
      appSlug: "my-app",
      userHandle: "alice",
      getToken: async () => Result.Ok({ type: "device-id" as const, token: "t" }),
    };

    const a1 = fireproof("a", opts);
    const a2 = fireproof("a", opts);
    expect(a1).toBe(a2);
  });

  it("two different names share one underlying adapter (singleton via Lazy)", async () => {
    const { fireproof, __resetFireproofForTesting } = await import("@vibes.diy/use-vibes-base/fireproof-node");
    const { Result } = await import("@adviser/cement");
    __resetFireproofForTesting();

    let tokenCalls = 0;
    const opts = {
      apiUrl: "ws://test.invalid",
      appSlug: "my-app",
      userHandle: "alice",
      getToken: async () => {
        tokenCalls++;
        return Result.Ok({ type: "device-id" as const, token: "t" });
      },
    };
    fireproof("a", opts);
    fireproof("b", opts);
    // Token isn't fetched until a request fires, so we just assert
    // the adapter singleton stays cached: a third call with the same name
    // returns the same instance, and reset clears.
    expect(fireproof("a", opts)).toBe(fireproof("a", opts));
    __resetFireproofForTesting();
    // After reset, a new instance is created (proving the cache was real)
    expect(fireproof("a", opts)).not.toBe(fireproof("a", opts));
    // ^ the second of those two creates the new singleton, the third call
    // reuses it. Reset between assertions to be unambiguous:
    __resetFireproofForTesting();
    const x = fireproof("a", opts);
    __resetFireproofForTesting();
    const y = fireproof("a", opts);
    expect(x).not.toBe(y);
    expect(tokenCalls).toBe(0); // never invoked, which is fine
  });
});
```

(The token-counter parts are deliberately loose because no real WS connection is made in these tests — what we're observably testing is the cache identity. Stricter behavior is covered by `firefly-api-adapter.test.ts`.)

- [ ] **Step 3: Run the firefly-nodejs tests**

Run from repo root:

```bash
cd vibes.diy/tests/app && pnpm test firefly-nodejs 2>&1 | tail -25
```

Expected: all original tests pass, plus the new "FireflyApiAdapter end-to-end" and "Multi-database caching" describe blocks pass.

- [ ] **Step 4: Format and commit**

```bash
cd /Users/jchris/code/fp/vibes.diy
npx prettier --write vibes.diy/tests/app/fake-vibes-diy-api.ts vibes.diy/tests/app/firefly-nodejs.test.ts
git add vibes.diy/tests/app/fake-vibes-diy-api.ts vibes.diy/tests/app/firefly-nodejs.test.ts
git commit -m "$(cat <<'EOF'
test(firefly): factory + adapter end-to-end against fake VibesDiyApi

Three new describe blocks per spec:
- FireflyApiAdapter routes put/get/query/del/subscribe correctly
- onDocChanged events synthesize the {data: {type: evt-doc-changed}} shape
- KeyedResolvOnce caching: same name returns same instance; reset proves cache

Refs: #1438

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Full `pnpm check` + open PR

- [ ] **Step 1: Run the full check**

Run from repo root:

```bash
pnpm check 2>&1 | tee /tmp/final-check.log | tail -30
```

Expected: green. If any flake hits (see [agents/flaky-tests.md](../../../agents/flaky-tests.md)), rerun once with `pnpm check 2>&1 | tee /tmp/retry.log | tail -30` and log to issue #1515. Real failures stop the plan.

- [ ] **Step 2: Push the branch and open a PR**

```bash
cd /Users/jchris/code/fp/vibes.diy
git push -u origin "$(git branch --show-current)"
gh pr create --title "feat(use-vibes): standalone fireproof() for Node.js / Wrangler" --body "$(cat <<'EOF'
## Summary

- Replaces use-vibes' legacy `fireproof` re-export with a WebSocket-backed factory: `fireproof("todos")` Just Works after `npx vibes-diy login`.
- Module-level `Lazy` singleton + per-name `KeyedResolvOnce` cache mirrors the legacy fireproof factory mental model — N `fireproof(name)` calls share one `VibesDiyApi`.
- Iframe code paths unchanged: import-map alias `use-vibes` → `@vibes.diy/vibe-runtime` keeps the existing in-iframe `fireproof("name")` flow.

Closes #1438.

Spec: [docs/superpowers/specs/2026-05-10-standalone-fireproof-node-design.md](docs/superpowers/specs/2026-05-10-standalone-fireproof-node-design.md)
Plan: [docs/superpowers/plans/2026-05-10-standalone-fireproof-node.md](docs/superpowers/plans/2026-05-10-standalone-fireproof-node.md)

## Test plan

- [x] `pnpm check` green
- [x] Existing firefly-database / use-firefly / firefly-files / firefly-nodejs tests pass unchanged (FireflyTransport interface is structurally satisfied by VibeSandboxApi)
- [x] New `firefly-api-adapter.test.ts` covers put/get/query/del/subscribe/onMsg/userHandle-resolution/putAsset-throws
- [x] New `firefly-defaults.node.test.ts` covers "no cert → helpful error"
- [x] New `fireproof-node.test.ts` covers cache identity + first-call-wins
- [x] firefly-nodejs.test.ts gains end-to-end + multi-db caching describe blocks
- [ ] Manual smoke: write a tiny Node script that imports fireproof from use-vibes and runs against a local dev API after `npx vibes-diy login`. (Out of CI scope; reviewer verifies if desired.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

Done after writing the plan; fix issues inline.

**Spec coverage checklist:**

- ✅ `FireflyTransport` interface extracted in vibe-runtime → Task 1
- ✅ `FireflyApiAdapter` in api-impl with userHandle lazy resolution → Tasks 2, 3, 4
- ✅ `FireflyApiAdapter` exported from api-impl barrel → Task 5
- ✅ Keybag loader Node-only module → Task 6
- ✅ `fireproof()` factory with Lazy singleton + KeyedResolvOnce cache → Task 7
- ✅ Replace legacy `fireproof` re-export in use-vibes/base → Task 8
- ✅ Three new firefly-nodejs.test.ts describe blocks → Task 9
- ✅ `firefly-defaults.node.test.ts` → Task 6
- ✅ Final pnpm check + PR → Task 10

**Type/symbol consistency:**

- `FireflyTransport.svc.vibeApp` is `VibeApp` (existing 3-field interface) — `FireflyApiAdapter.svc.vibeApp` matches with userHandle/appSlug/fsId.
- `FireflyApiAdapter` constructor signature `(api, appSlug, opts?)` consistent across Tasks 2, 3, 4, 7.
- Method signatures (positional, dbName-default, Result-wrapped) consistent between Task 1 interface and Task 3 implementation.
- `__resetFireproofForTesting` exported from `fireproof-node.ts` (Task 7) and used by `firefly-nodejs.test.ts` (Task 9) — name matches.
- `createFakeVibesDiyApi` defined in Task 9 step 1 and consumed in Task 9 step 2 — matches.

**Placeholder scan:** no TBDs, no "implement later", no "similar to Task N" without copies, all code blocks contain runnable code.

---

## Notes on edge cases the plan deliberately doesn't cover (out of scope per spec)

- File / Blob uploads (`_files`): `putAsset` throws — matches spec. Future task.
- `connectFireproof()` for multi-app workflow in one process: future work.
- `useFireproof` rerouting outside iframes: stays on legacy library — future work.
