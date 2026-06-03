# `useFireproof` ACL Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a `useFireproof('db', { acl: { write: ['editors'] } })` option through the Firefly/postMessage stack so vibe apps can declare per-database access control at point of use.

**Architecture:** The server-side enforcement layer (`ensureAppSettings`, `resolveDbAcl`, `aclAllows`) is already built and tested. This plan only wires the client-to-server path: vibe runtime → postMessage → `vibesDiySrvSandbox` handler → `vibeDiyApi.ensureAppSettings`. The `acl` option fires fire-and-forget alongside `subscribeDocs` when a `FireflyDatabase` is constructed; the server's owner-only check means non-owner options are silently ignored. `pnpm check` is the full CI gate (`format + build + test + lint`); run `pnpm fast-check` locally during development.

**Tech Stack:** TypeScript, arktype (schema/type validation), `@adviser/cement` (Result/Future), Evento (handler dispatch), vitest

---

## File Map

| File                                                 | Change                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `vibes.diy/vibe/types/index.ts`                      | Add `ReqSetDbAcl`, `ResSetDbAcl`, `isReqSetDbAcl`, `isResSetDbAcl`; re-export `DbAcl` |
| `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`          | Add `vibeSetDbAcl` handler function + register it                                     |
| `vibes.diy/vibe/runtime/register-dependencies.ts`    | Add `setDbAcl()` to `VibeSandboxApi` + `FireflyTransport` interface                   |
| `vibes.diy/vibe/runtime/firefly-database.ts`         | Add optional `acl` param to constructor; add `applyAcl()` method                      |
| `vibes.diy/vibe/runtime/use-firefly.ts`              | Thread `acl` option from `useFireproof` config through `getOrCreateDb`                |
| `vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts` | **New** — unit test for `vibeSetDbAcl` handler                                        |
| `vibes.diy/api/tests/firefly-database-acl.test.ts`   | **New** — unit test for `FireflyDatabase` acl option                                  |

---

## Task 1: Add `ReqSetDbAcl` / `ResSetDbAcl` types and re-export `DbAcl`

**Files:**

- Modify: `vibes.diy/vibe/types/index.ts`

Context: `vibe/types/index.ts` is the `@vibes.diy/vibe-types` package. `Base = type({ tid: 'string' })` is defined at the top. `dbAcl` is already imported from `@vibes.diy/api-types` at line 1. The `ReqSubscribeDocs` block ends around line 434 — add new types immediately after. All request types follow the pattern: `type({...}).and(Base)`.

- [ ] **Step 1: Update the import at line 1 to also pull in `DbAcl`**

In `vibes.diy/vibe/types/index.ts`, change line 1 from:

```typescript
import { FPCloudClaim, dbAcl } from "@vibes.diy/api-types";
```

to:

```typescript
import { FPCloudClaim, dbAcl, type DbAcl } from "@vibes.diy/api-types";
```

- [ ] **Step 2: Re-export `DbAcl` so `vibe/runtime` files can import it from `@vibes.diy/vibe-types`**

After the `export * from "./img-gen.js"` line (line 4), add:

```typescript
export type { DbAcl };
```

- [ ] **Step 3: Add `ReqSetDbAcl` after the `ReqSubscribeDocs` block**

Find the end of the `ReqSubscribeDocs` block (the `isReqSubscribeDocs` function, currently around line 432–434) and add immediately after:

```typescript
export const ReqSetDbAcl = type({
  type: "'vibes.diy.req-set-db-acl'",
  appSlug: "string",
  userHandle: "string",
  dbName: "string",
  acl: dbAcl,
}).and(Base);

export type ReqSetDbAcl = typeof ReqSetDbAcl.infer;

export function isReqSetDbAcl(x: unknown): x is ReqSetDbAcl {
  return !(ReqSetDbAcl(x) instanceof type.errors);
}
```

- [ ] **Step 4: Add `ResSetDbAcl` as a manual interface (matches both ok and error responses)**

Add immediately after `isReqSetDbAcl`:

```typescript
// Manual interface — matches both ok and error so the client resolves quickly
// instead of timing out on server-side owner-only rejections.
export interface ResSetDbAcl {
  readonly tid: string;
  readonly type: "vibes.diy.res-set-db-acl";
  readonly status: "ok" | "error";
  readonly message?: string;
}

export function isResSetDbAcl(x: unknown): x is ResSetDbAcl {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return r.type === "vibes.diy.res-set-db-acl" && typeof r.tid === "string" && (r.status === "ok" || r.status === "error");
}
```

- [ ] **Step 5: Verify TypeScript compilation**

```bash
cd vibes.diy && pnpm fast-check 2>&1 | head -40
```

Expected: no errors related to `ReqSetDbAcl`, `ResSetDbAcl`, or `DbAcl`.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/types/index.ts
git commit -m "feat(vibe-types): add ReqSetDbAcl / ResSetDbAcl message types, re-export DbAcl"
```

---

## Task 2: Write failing test for `vibeSetDbAcl` host handler

**Files:**

- Create: `vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts`

Context: The test follows `srv-sandbox-who-am-i.test.ts` exactly. `vibesDiySrvSandbox` is imported from `@vibes.diy/vibe-srv-sandbox`. `VibesDiyApiIface` is from `@vibes.diy/api-types`. A fake `VibesDiyApiIface` is created with all required stubs. `sandbox.handleMessage(fakeMessageEvent(...))` is the entry point. The `captured` array collects what the sandbox posts back to the iframe. The test awaits `setTimeout(r, 50)` to let async handlers complete.

- [ ] **Step 1: Create the test file**

```typescript
// vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface, VibesDiyError } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";
import type { ResEnsureAppSettings, ReqEnsureAppSettings, Req } from "@vibes.diy/api-types";
import type { DbAcl } from "@vibes.diy/vibe-types";

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

interface CapturedMsg {
  readonly data: unknown;
  readonly origin: string;
}

function fakeMessageEvent(data: unknown, origin: string, source: Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

function setupSandbox() {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const ensureAppSettingsCalls: Array<Req<ReqEnsureAppSettings>> = [];
  const fakeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    ensureAppSettings: async (req) => {
      ensureAppSettingsCalls.push(req);
      return Result.Ok({} as ResEnsureAppSettings);
    },
  };

  const sandbox = new vibesDiySrvSandbox({
    vibeDiyApi: fakeApi as VibesDiyApiIface,
    errorLogger: () => {
      /* noop */
    },
    eventListeners: {
      addEventListener: () => {
        /* noop */
      },
      removeEventListener: () => {
        /* noop */
      },
    },
  });

  return { sandbox, captured, iframe, ensureAppSettingsCalls };
}

describe("vibeSetDbAcl host handler", () => {
  it("happy path — calls vibeDiyApi.ensureAppSettings with dbAcl and posts res-set-db-acl ok", async () => {
    const { sandbox, captured, iframe, ensureAppSettingsCalls } = setupSandbox();
    const acl: DbAcl = { write: ["editors"], delete: ["editors"] };

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibes.diy.req-set-db-acl",
          tid: "t1",
          appSlug: "myapp",
          userHandle: "alice",
          dbName: "announcements",
          acl,
        },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(ensureAppSettingsCalls).toHaveLength(1);
    expect(ensureAppSettingsCalls[0]).toMatchObject({
      appSlug: "myapp",
      userHandle: "alice",
      dbAcl: { dbName: "announcements", acl },
    });

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-set-db-acl");
    expect(msg?.data).toMatchObject({
      tid: "t1",
      type: "vibes.diy.res-set-db-acl",
      status: "ok",
    });
  });

  it("error path — when ensureAppSettings fails, posts res-set-db-acl with status error", async () => {
    const captured: CapturedMsg[] = [];
    const iframe = {
      postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
    } as unknown as Window;

    const fakeApi: Partial<VibesDiyApiIface> = {
      onDocChanged: () => () => {
        /* noop */
      },
      ensureAppSettings: async () =>
        Result.Err<ResEnsureAppSettings, VibesDiyError>({
          type: "vibes.diy.res-error",
          name: "VibesDiyError",
          message: "forbidden",
        } as VibesDiyError),
    };

    const sandbox = new vibesDiySrvSandbox({
      vibeDiyApi: fakeApi as VibesDiyApiIface,
      errorLogger: () => {
        /* noop */
      },
      eventListeners: {
        addEventListener: () => {
          /* noop */
        },
        removeEventListener: () => {
          /* noop */
        },
      },
    });

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibes.diy.req-set-db-acl",
          tid: "t2",
          appSlug: "myapp",
          userHandle: "alice",
          dbName: "announcements",
          acl: { write: ["editors"] },
        },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-set-db-acl");
    expect(msg?.data).toMatchObject({
      tid: "t2",
      type: "vibes.diy.res-set-db-acl",
      status: "error",
    });
  });

  it("ignores messages with wrong type", async () => {
    const { sandbox, captured, iframe, ensureAppSettingsCalls } = setupSandbox();

    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "something-else", tid: "t3", appSlug: "a", userHandle: "b", dbName: "c", acl: {} },
        "https://a--b.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(ensureAppSettingsCalls).toHaveLength(0);
    expect(captured.filter((c) => (c.data as { type?: string }).type === "vibes.diy.res-set-db-acl")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails because the handler doesn't exist yet**

```bash
cd vibes.diy && pnpm --filter @vibes.diy/tests test -- --reporter=verbose api/tests/srv-sandbox-set-db-acl.test.ts 2>&1 | tail -20
```

Expected: tests fail — the happy path message is never sent because `vibeSetDbAcl` hasn't been added to the sandbox yet.

- [ ] **Step 3: Commit the failing test**

```bash
git add vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts
git commit -m "test(srv-sandbox): failing test for vibeSetDbAcl handler"
```

---

## Task 3: Implement `vibeSetDbAcl` handler in `srv-sandbox.ts`

**Files:**

- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`

Context: Handlers are plain functions that take `sandbox: vibesDiySrvSandbox` and return an `EventoHandler`. Handlers are registered in the array at line ~946. `isReqSetDbAcl` and `ReqSetDbAcl` come from `@vibes.diy/vibe-types`. `vibeDiyApi.ensureAppSettings` takes `Req<ReqEnsureAppSettings>` — the `Req<>` wrapper strips `type` and `auth` from the request type, so you just pass `{ userHandle, appSlug, dbAcl: { dbName, acl } }`.

- [ ] **Step 1: Add `isReqSetDbAcl` and `ReqSetDbAcl` to the import from `@vibes.diy/vibe-types`**

In `srv-sandbox.ts`, find the import from `@vibes.diy/vibe-types` (lines ~20–62) and add `isReqSetDbAcl` and `ReqSetDbAcl` to it:

```typescript
  isReqSetDbAcl,
  ReqSetDbAcl,
```

(Add alphabetically near `isReqSubscribeDocs` / `ReqSubscribeDocs`.)

- [ ] **Step 2: Add the `vibeSetDbAcl` function after `vibeSubscribeDocs`**

After the closing `}` of `vibeSubscribeDocs` (currently around line 650), add:

```typescript
function vibeSetDbAcl(sandbox: vibesDiySrvSandbox): EventoHandler {
  const { vibeDiyApi } = sandbox.args;
  return {
    hash: "vibe.setDbAcl",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqSetDbAcl(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqSetDbAcl, unknown>): Promise<Result<EventoResultType>> => {
      const rRes = await vibeDiyApi.ensureAppSettings({
        userHandle: ctx.validated.userHandle,
        appSlug: ctx.validated.appSlug,
        dbAcl: { dbName: ctx.validated.dbName, acl: ctx.validated.acl },
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-set-db-acl",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-set-db-acl",
          status: "ok",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}
```

- [ ] **Step 3: Register `vibeSetDbAcl` in the handlers array**

In the handlers array (around line 946), add `vibeSetDbAcl(this)` after `vibeSubscribeDocs(this)`:

```typescript
        vibeSubscribeDocs(this),
        vibeSetDbAcl(this),   // ← add this line
        vibeListDbNames(this),
```

- [ ] **Step 4: Run the test — confirm it passes**

```bash
cd vibes.diy && pnpm --filter @vibes.diy/tests test -- --reporter=verbose api/tests/srv-sandbox-set-db-acl.test.ts 2>&1 | tail -20
```

Expected: all 3 tests pass.

- [ ] **Step 5: Run fast-check to confirm no regressions**

```bash
cd vibes.diy && pnpm fast-check 2>&1 | tail -20
```

Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/vibe/srv-sandbox/srv-sandbox.ts
git commit -m "feat(srv-sandbox): add vibeSetDbAcl handler — routes req-set-db-acl to ensureAppSettings"
```

---

## Task 4: Add `setDbAcl()` to `FireflyTransport` and `VibeSandboxApi`

**Files:**

- Modify: `vibes.diy/vibe/runtime/register-dependencies.ts`

Context: `FireflyTransport` (line 35 of `firefly-database.ts`) is the interface that both `VibeSandboxApi` and `FireflyApiAdapter` implement. Adding `setDbAcl` here means both transports need the method. `VibeSandboxApi` lives in `register-dependencies.ts` and already has `subscribeDocs` as a model — `setDbAcl` follows the same pattern. `ResSetDbAcl` and `isResSetDbAcl` are imported from `@vibes.diy/vibe-types`. `DbAcl` is also available from `@vibes.diy/vibe-types` (added in Task 1).

- [ ] **Step 1: Add `ResSetDbAcl`, `isResSetDbAcl`, and `DbAcl` to the import from `@vibes.diy/vibe-types`**

In `register-dependencies.ts`, find the import from `@vibes.diy/vibe-types` (lines ~1–42) and add:

```typescript
  isResSetDbAcl,
  type ResSetDbAcl,
  type DbAcl,
```

- [ ] **Step 2: Add `setDbAcl` to the `FireflyTransport` interface in `firefly-database.ts`**

In `firefly-database.ts`, find `FireflyTransport` interface (line ~35). After `subscribeDocs(dbName?: string)`, add:

```typescript
  setDbAcl(dbName: string, acl: DbAcl): Promise<Result<ResSetDbAcl>>;
```

This requires adding `ResSetDbAcl` and `DbAcl` to imports in `firefly-database.ts`:

```typescript
import {
  // ... existing imports ...
  type ResSetDbAcl,
  type DbAcl,
} from "@vibes.diy/vibe-types";
```

- [ ] **Step 3: Add `setDbAcl()` method to `VibeSandboxApi` in `register-dependencies.ts`**

After the `subscribeDocs` method (around line 293), add:

```typescript
  setDbAcl(dbName: string, acl: DbAcl): Promise<Result<ResSetDbAcl>> {
    return this.request<{ type: string; appSlug: string; userHandle: string; dbName: string; acl: DbAcl }, ResSetDbAcl>(
      {
        type: "vibes.diy.req-set-db-acl",
        ...this.svc.vibeApp,
        dbName,
        acl,
      },
      { wait: isResSetDbAcl, timeout: 10000 }
    );
  }
```

- [ ] **Step 4: Run fast-check to confirm TypeScript is happy**

```bash
cd vibes.diy && pnpm fast-check 2>&1 | grep -E "error TS|ERROR|FAIL" | head -20
```

Expected: no new TypeScript errors. (TypeScript will catch if `FireflyApiAdapter` doesn't implement `setDbAcl` yet — if that error appears, add a stub there too. Search for `FireflyApiAdapter` with `grep -r FireflyApiAdapter vibes.diy/` to find its file.)

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/runtime/register-dependencies.ts vibes.diy/vibe/runtime/firefly-database.ts
git commit -m "feat(vibe-runtime): add setDbAcl to FireflyTransport + VibeSandboxApi"
```

---

## Task 5: Thread `acl` through `FireflyDatabase` constructor and `useFireproof`

**Files:**

- Create: `vibes.diy/api/tests/firefly-database-acl.test.ts`
- Modify: `vibes.diy/vibe/runtime/firefly-database.ts`
- Modify: `vibes.diy/vibe/runtime/use-firefly.ts`

Context: `FireflyDatabase` constructor (line ~105 of `firefly-database.ts`) already calls `this.vibeApi.subscribeDocs(this.name)` fire-and-forget. Adding `acl` follows the same fire-and-forget pattern. `getOrCreateDb` in `use-firefly.ts` (line ~18) is the single place that constructs `FireflyDatabase` — thread `acl` here. If a db is already cached and a new `acl` is given, call `applyAcl()` to re-apply it (last-write-wins behavior).

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/api/tests/firefly-database-acl.test.ts`:

```typescript
// vibes.diy/api/tests/firefly-database-acl.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { FireflyDatabase, type FireflyTransport } from "@vibes.diy/vibe-runtime";
import { Result } from "@adviser/cement";
import type { DbAcl } from "@vibes.diy/vibe-types";

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

function makeFakeTransport(setDbAclFn?: (dbName: string, acl: DbAcl) => void): FireflyTransport {
  return {
    svc: { vibeApp: { appSlug: "myapp", userHandle: "alice", fsId: "fs1" } },
    putDoc: () => Promise.resolve(Result.Err("not used")),
    getDoc: () => Promise.resolve(Result.Err("not used")),
    queryDocs: () => Promise.resolve(Result.Err("not used")),
    deleteDoc: () => Promise.resolve(Result.Err("not used")),
    subscribeDocs: () => Promise.resolve(Result.Ok({ type: "vibes.diy.res-subscribe-docs" as const, status: "ok" as const })),
    setDbAcl: (dbName, acl) => {
      setDbAclFn?.(dbName, acl);
      return Promise.resolve(
        Result.Ok({
          type: "vibes.diy.res-set-db-acl" as const,
          status: "ok" as const,
          tid: "fake-tid",
        })
      );
    },
    onMsg: () => {},
  };
}

describe("FireflyDatabase acl option", () => {
  it("calls setDbAcl on construction when acl is provided", async () => {
    const calls: Array<{ dbName: string; acl: DbAcl }> = [];
    const transport = makeFakeTransport((dbName, acl) => calls.push({ dbName, acl }));

    const acl: DbAcl = { write: ["editors"], delete: ["editors"] };
    new FireflyDatabase("announcements", transport, acl);

    // setDbAcl is fire-and-forget; wait for microtasks
    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ dbName: "announcements", acl });
  });

  it("does NOT call setDbAcl when no acl is provided", async () => {
    const calls: Array<{ dbName: string; acl: DbAcl }> = [];
    const transport = makeFakeTransport((dbName, acl) => calls.push({ dbName, acl }));

    new FireflyDatabase("default", transport);

    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toHaveLength(0);
  });

  it("applyAcl calls setDbAcl with the new acl", async () => {
    const calls: Array<{ dbName: string; acl: DbAcl }> = [];
    const transport = makeFakeTransport((dbName, acl) => calls.push({ dbName, acl }));

    const db = new FireflyDatabase("general", transport);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(0); // no acl on construction

    const acl: DbAcl = { write: ["members"] };
    db.applyAcl(acl);
    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ dbName: "general", acl });
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

```bash
cd vibes.diy && pnpm --filter @vibes.diy/tests test -- --reporter=verbose api/tests/firefly-database-acl.test.ts 2>&1 | tail -20
```

Expected: TypeScript or runtime errors — `FireflyDatabase` constructor doesn't accept a third argument and has no `applyAcl` method yet.

- [ ] **Step 3: Implement `acl` param and `applyAcl()` in `FireflyDatabase`**

In `vibes.diy/vibe/runtime/firefly-database.ts`, update the constructor signature and body:

```typescript
  constructor(name: string, vibeApi: FireflyTransport, acl?: DbAcl) {
    this.name = name;
    this.vibeApi = vibeApi;
    this.vibeApp = vibeApi.svc.vibeApp;

    // Subscribe to remote doc-changed events for THIS db (cross-client sync).
    this.vibeApi.subscribeDocs(this.name).then((rRes) => {
      if (rRes.isErr()) {
        console.error(`Failed to subscribe to docs for db "${this.name}":`, rRes.Err());
      }
    });

    if (acl) {
      this.applyAcl(acl);
    }

    // Listen for remote doc-changed events.
    this.vibeApi.onMsg((event) => {
      const { data } = event;
      if (
        isEvtDocChanged(data) &&
        data.userHandle === this.vibeApp.userHandle &&
        data.appSlug === this.vibeApp.appSlug &&
        data.dbName === this.name
      ) {
        this.notifyListeners([]);
      }
    });
  }

  applyAcl(acl: DbAcl): void {
    this.vibeApi.setDbAcl(this.name, acl).then((rRes) => {
      if (rRes.isErr()) {
        console.error(`setDbAcl request failed for db "${this.name}":`, rRes.Err());
        return;
      }
      if (rRes.Ok().status === "error") {
        console.error(`setDbAcl server error for db "${this.name}": ${rRes.Ok().message ?? "unknown"}`);
      }
    });
  }
```

- [ ] **Step 4: Thread `acl` through `getOrCreateDb` and `useFireproof` in `use-firefly.ts`**

In `vibes.diy/vibe/runtime/use-firefly.ts`, update `getOrCreateDb` and `useFireproof`:

```typescript
function getOrCreateDb(name: string, acl?: DbAcl): FireflyDatabase {
  let db = dbCache.get(name);
  if (!db) {
    if (!vibeApiRef) {
      throw new Error("Firefly not initialized — registerFirefly() must be called before useFireproof()");
    }
    db = new FireflyDatabase(name, vibeApiRef, acl);
    dbCache.set(name, db);
  } else if (acl) {
    // Re-apply acl on re-open with different or same options (last-write-wins on server).
    db.applyAcl(acl);
  }
  return db;
}
```

And update `useFireproof`:

```typescript
export function useFireproof(name = "useFireproof", config: { acl?: DbAcl; [key: string]: unknown } = {}) {
  const database = useMemo(() => getOrCreateDb(name, config.acl), [name]);
  const useDocument = useMemo(() => createUseDocument(database), [database]);
  const useLiveQuery = useMemo(() => createUseLiveQuery(database), [database]);
  const useAllDocs = useMemo(() => createUseAllDocs(database), [database]);
  const useChanges = useMemo(() => createUseChanges(database), [database]);
  const attach = () => Promise.resolve();
  return { database, useLiveQuery, useDocument, useAllDocs, useChanges, attach };
}
```

Add `DbAcl` to the imports in `use-firefly.ts`:

```typescript
import type { DbAcl } from "@vibes.diy/vibe-types";
```

- [ ] **Step 5: Run the test — confirm it passes**

```bash
cd vibes.diy && pnpm --filter @vibes.diy/tests test -- --reporter=verbose api/tests/firefly-database-acl.test.ts 2>&1 | tail -20
```

Expected: all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/api/tests/firefly-database-acl.test.ts \
        vibes.diy/vibe/runtime/firefly-database.ts \
        vibes.diy/vibe/runtime/use-firefly.ts
git commit -m "feat(firefly): thread acl option through FireflyDatabase constructor and useFireproof"
```

---

## Task 6: Full check and wrap-up

**Files:** none new

- [ ] **Step 1: Run the full check suite**

```bash
cd vibes.diy && pnpm check 2>&1 | tee /tmp/pnpm-check-acl.log
grep -E "FAIL|ERROR|error TS" /tmp/pnpm-check-acl.log | head -20
```

Expected: no failures. If `FireflyApiAdapter` (used in the CLI/Node path) also implements `FireflyTransport`, TypeScript will have complained in Task 4 Step 4. If it appears now, find it with:

```bash
grep -rn "FireflyApiAdapter\|implements FireflyTransport" vibes.diy/ --include="*.ts" | grep -v "node_modules\|.wrangler"
```

Add a stub `setDbAcl` implementation that returns `Result.Err('not supported')` or a real implementation if needed.

- [ ] **Step 2: Run prettier on changed files**

```bash
cd vibes.diy && npx prettier --write \
  vibe/types/index.ts \
  vibe/srv-sandbox/srv-sandbox.ts \
  vibe/runtime/register-dependencies.ts \
  vibe/runtime/firefly-database.ts \
  vibe/runtime/use-firefly.ts \
  api/tests/srv-sandbox-set-db-acl.test.ts \
  api/tests/firefly-database-acl.test.ts
```

- [ ] **Step 3: Final commit if prettier changed anything**

```bash
git diff --stat
# If files changed:
git add -p  # stage only the changed files
git commit -m "chore: prettier formatting on acl-option implementation"
```

- [ ] **Step 4: Final check passes clean**

```bash
cd vibes.diy && pnpm check 2>&1 | tail -10
```

Expected: clean exit.

---

## Self-Review Checklist

**Spec coverage:**

- ✅ `useFireproof('db', { acl: { write: ['members'] } })` — implemented in Task 5
- ✅ ACL fires on database open, sent to server — Task 5 `applyAcl` in constructor
- ✅ No separate settings API call needed — handler routes to `ensureAppSettings` transparently
- ✅ Non-owner ACL options silently ignored — server-enforced, no client change needed
- ✅ Last-write-wins reconciliation — `getOrCreateDb` calls `applyAcl` on re-open
- ✅ Opening without `acl` is a no-op — `if (acl)` guard in constructor and `getOrCreateDb`
- ✅ `comments` default ACL override — explicit `acl` option calls `ensureAppSettings`, which overwrites the lazy default
- ✅ Tests for happy path, error path, no-op — Tasks 2 and 5

**Placeholder scan:** No TBDs, no incomplete steps, all code blocks provided.

**Type consistency:**

- `DbAcl` — added to `vibe-types` exports in Task 1, imported in Tasks 4 and 5
- `ResSetDbAcl` — defined in Task 1, used in Tasks 3 and 4
- `isResSetDbAcl` — defined in Task 1, used in Task 4 (`VibeSandboxApi.setDbAcl` wait fn)
- `isReqSetDbAcl` — defined in Task 1, used in Task 3 (handler validate fn)
- `ReqSetDbAcl` — defined in Task 1, used in Task 3 (handler type annotation)
- `applyAcl(acl: DbAcl): void` — defined in Task 5 Step 3, called in Task 5 Step 4 (`getOrCreateDb`)
- `FireflyDatabase(name, transport, acl?)` — third param added in Task 5 Step 3, used in Task 5 Step 4 (`getOrCreateDb`)
- `setDbAcl(dbName, acl)` on `FireflyTransport` — added in Task 4, implemented on `VibeSandboxApi` in Task 4, called in Task 5 `applyAcl`

**`FireflyApiAdapter` gap:** If `FireflyApiAdapter` exists and implements `FireflyTransport`, Task 4 TypeScript check will catch it. Task 6 handles it with a fallback stub.
