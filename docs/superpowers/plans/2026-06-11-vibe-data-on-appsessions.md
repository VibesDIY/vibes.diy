# Vibe data always on AppSessions — close the silent ChatSession leak (#2306) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make vibe document data + DB subscriptions ride `AppSessions` (which wires the doc-changed emit) on every route that renders the vibe-data iframe — including the `/chat/` editor — closing the silent live-cross-user-sync leak where vibe data fell back to `ChatSessions` and emitted nothing.

**Architecture:** Two changes that must land together. (1) The browser provider builds `vibeApi` (→ `/api/app?vibe=owner--app`, AppSessions) for the `/chat/:ownerHandle/:appSlug` editor route, not only `/vibe/…`, reactively via `useLocation()`. (2) The `srv-sandbox` Firefly data handlers stop falling back to `chatApi` (ChatSessions) and instead require `vibeApi`, returning a typed bridge error when it is absent. Provider-first ordering keeps the editor working at every commit.

**Tech Stack:** TypeScript, React Router v7 (framework mode), `@adviser/cement` (`Result`/`Option`), arktype, Cloudflare Durable Objects, Vitest (browser + node).

**Scope note — deferred to follow-ups (NOT in this plan):** Spec step 4 (a static/shared-shard handler so `ChatSessions` connects only when chatting — a connection-topology change for home/settings pages) and spec step 5 (flipping the `ChatSessions` emit from a runtime no-op to a *compile-time* type error). Per CharlieHelps' review, the type-error flip is explicitly gated on full migration being complete (zero `vibeApi ?? chatApi` callsites, no `chatApi.onDocChanged` forwarding, `chatMsgEvento` no longer including `appHandlers`, all `chatApi` doc-op callsites migrated). This plan delivers the first three of those preconditions; the flip and the static handler are separate PRs. Per CharlieHelps: `callAI` and `updateAvatarCid` **stay on `chatApi`** (LLM/billing and user-settings scoped); only `imgGen` moves to `vibeApi`.

**Reference spec:** `docs/superpowers/specs/2026-06-11-vibe-data-on-appsessions-design.md` (in this branch). Issue/PR: #2329, root cause #2306.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `vibes.diy/pkg/app/vibe-api-target.ts` | Pure function mapping a pathname → the `{ ownerHandle, appSlug }` that should own a `vibeApi`, for both `/vibe/` and `/chat/` editor routes (placeholder-guarded). | **Create** |
| `vibes.diy/tests/app/vibe-api-target.test.ts` | Unit tests for the pathname matcher. | **Create** |
| `vibes.diy/pkg/app/vibes-diy-provider.tsx` | Build `vibeApi` for every iframe-rendering route, reactively. | **Modify** (`vibeMatch` block ~232-252, add `useLocation`) |
| `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` | Firefly handlers require `vibeApi`; `imgGen` moves to `vibeApi`; dead `chatApi.onDocChanged` removed. | **Modify** (9 data handlers, `imgGen` L273, constructor L931-964) |
| `vibes.diy/api/tests/srv-sandbox-put-doc.test.ts` | Existing handler test — update to pass `vibeApi`, add missing-`vibeApi` error case. | **Modify** |
| `vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts` | Existing handler test — update to pass `vibeApi`. | **Modify** |
| `vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts` | New: the typed-error path for each migrated data handler when `vibeApi` is absent. | **Create** |

**How to run tests referenced below:**
- srv-sandbox handler tests (node): from `vibes.diy/api/tests/` run `pnpm test -- <file>` (vitest project name `api-tests`).
- provider/app tests (browser): from `vibes.diy/tests/app/` run `pnpm test -- <file>` (vitest project name `vibes.diy`, playwright/chromium).
- Full gate before any PR push: `pnpm check` from repo root (format + build + test + lint). Run `npx prettier --write` on changed files first.

---

## Task 1: Pathname → vibeApi target matcher (pure function)

**Files:**
- Create: `vibes.diy/pkg/app/vibe-api-target.ts`
- Test: `vibes.diy/tests/app/vibe-api-target.test.ts`

Today the provider builds `vibeApi` only for `^/vibe/([^/]+)/([^/]+)` ([`vibes-diy-provider.tsx:232`](../../../vibes.diy/pkg/app/vibes-diy-provider.tsx)). The editor route is `chat/:ownerHandle/:appSlug/:fsId?` ([`routes.ts:11`](../../../vibes.diy/pkg/app/routes.ts)); a fresh chat lives at `chat/prompt` (no slugs) and navigates to `/chat/<owner>/<appSlug>` only after `openChat` returns real slugs ([`prompt.tsx:72`](../../../vibes.diy/pkg/app/routes/chat/prompt.tsx)). Extract the match into a pure, unit-testable function that covers both routes and guards the component-default placeholders `"preparing"` / `"session"` ([`chat.$ownerHandle.$appSlug.tsx:331-346`](../../../vibes.diy/pkg/app/routes/chat/chat.$ownerHandle.$appSlug.tsx)).

- [ ] **Step 1: Write the failing test**

Create `vibes.diy/tests/app/vibe-api-target.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { vibeApiTarget } from "@vibes.diy/app/vibe-api-target";

describe("vibeApiTarget", () => {
  it("matches a /vibe/ viewer route", () => {
    expect(vibeApiTarget("/vibe/alice/notes")).toEqual({ ownerHandle: "alice", appSlug: "notes" });
  });

  it("matches a /chat/ editor route", () => {
    expect(vibeApiTarget("/chat/alice/notes")).toEqual({ ownerHandle: "alice", appSlug: "notes" });
  });

  it("matches a /chat/ editor route with a trailing fsId segment", () => {
    expect(vibeApiTarget("/chat/alice/notes/abc123")).toEqual({ ownerHandle: "alice", appSlug: "notes" });
  });

  it("returns undefined for the new-chat prompt route", () => {
    expect(vibeApiTarget("/chat/prompt")).toBeUndefined();
  });

  it("returns undefined for placeholder editor params", () => {
    expect(vibeApiTarget("/chat/preparing/session")).toBeUndefined();
  });

  it("returns undefined for non-vibe, non-chat routes", () => {
    expect(vibeApiTarget("/")).toBeUndefined();
    expect(vibeApiTarget("/settings")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: from `vibes.diy/tests/app/` → `pnpm test -- vibe-api-target.test.ts`
Expected: FAIL — cannot resolve `@vibes.diy/app/vibe-api-target` (module not found).

(If the `@vibes.diy/app/...` import specifier does not resolve, mirror whatever specifier sibling tests in `vibes.diy/tests/app/` use to import from `pkg/app` — check `clerk-token-cache.test.ts` for the exact alias — and adjust the import accordingly. Do not invent a new alias.)

- [ ] **Step 3: Write minimal implementation**

Create `vibes.diy/pkg/app/vibe-api-target.ts`:

```ts
// Placeholder slugs the editor route component falls back to when params are
// absent (chat.$ownerHandle.$appSlug.tsx defaults). A chat with no appSlug yet
// must NOT get a vibeApi — see #2306 / the vibe-data-on-appsessions spec.
const PLACEHOLDER_OWNER = "preparing";
const PLACEHOLDER_APP = "session";

export interface VibeApiTarget {
  readonly ownerHandle: string;
  readonly appSlug: string;
}

/**
 * Given a pathname, return the vibe whose data should ride `vibeApi`
 * (AppSessions), or undefined if this route renders no vibe-data iframe.
 * Covers the `/vibe/` viewer and the `/chat/:owner/:appSlug` editor.
 */
export function vibeApiTarget(pathname: string): VibeApiTarget | undefined {
  const m = pathname.match(/^\/(?:vibe|chat)\/([^/]+)\/([^/]+)/);
  if (m === null) return undefined;
  const ownerHandle = m[1];
  const appSlug = m[2];
  if (ownerHandle === PLACEHOLDER_OWNER && appSlug === PLACEHOLDER_APP) return undefined;
  return { ownerHandle, appSlug };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: from `vibes.diy/tests/app/` → `pnpm test -- vibe-api-target.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/pkg/app/vibe-api-target.ts vibes.diy/tests/app/vibe-api-target.test.ts
git commit -m "feat(provider): pure vibeApi-target matcher for /vibe/ and /chat/ routes (#2306)"
```

---

## Task 2: Provider builds vibeApi for the /chat/ editor, reactively

**Files:**
- Modify: `vibes.diy/pkg/app/vibes-diy-provider.tsx` (imports; `LiveCycleVibesDiyProvider` body — the `vibeMatch` block at lines ~232-252; `chatApi` shardKey at line ~158-159)

`LiveCycleVibesDiyProvider` ([`vibes-diy-provider.tsx:131`](../../../vibes.diy/pkg/app/vibes-diy-provider.tsx)) reads `window.location.pathname` imperatively, so it does **not** re-evaluate on SPA navigation. After `openChat`, the app navigates from `chat/prompt` → `/chat/<owner>/<appSlug>` without remounting the provider, so `vibeApi` would never be built for a freshly-created chat. The provider is the root route element's child ([`root.tsx:92`](../../../vibes.diy/pkg/app/root.tsx)) and therefore sits inside the Router context, so `useLocation()` makes it reactive. Per CharlieHelps: hook `vibeApi` creation off route params becoming available in the provider — not in `AppPreview` mount.

- [ ] **Step 1: Add the reactive location + matcher import**

In `vibes.diy/pkg/app/vibes-diy-provider.tsx`, add to the React-Router import (or add a new import line) `useLocation`, and import the matcher:

```ts
import { useLocation } from "react-router";
import { vibeApiTarget } from "./vibe-api-target.js";
```

(Match the existing import style in the file — sibling app files import router hooks from `react-router`. If this file has no existing `react-router` import, add the line above.)

- [ ] **Step 2: Read the current location at the top of the provider body**

Immediately after `const clerk = useClerk();` ([line 132](../../../vibes.diy/pkg/app/vibes-diy-provider.tsx)), add:

```ts
  const location = useLocation();
  const target = vibeApiTarget(location.pathname);
```

- [ ] **Step 3: Replace the `/vibe/`-only vibeApi block with a target-driven block**

Replace the existing block at lines ~232-252:

```ts
  const vibeMatch = typeof window !== "undefined" ? window.location.pathname.match(/^\/vibe\/([^/]+)\/([^/]+)/) : null;
  if (vibeMatch !== null) {
    const ownerHandle = vibeMatch[1];
    const appSlug = vibeMatch[2];
    const appApiUrl = BuildURI.from(apiUrl)
      .pathname("/api/app")
      .cleanParams()
      .setParam("vibe", `${ownerHandle}--${appSlug}`)
      .toString();

    const capturedGetToken = sharedGetToken ?? realCtx.getToken;
    realCtx.vibeApi = vibesDiyApis.get(appApiUrl).once(() => {
      return new VibesDiyApi({
        apiUrl: appApiUrl,
        skipShard: true,
        getToken: capturedGetToken ?? (() => Promise.resolve(Result.Err("token not available"))),
      });
    });
  } else {
    realCtx.vibeApi = undefined;
  }
```

with:

```ts
  // Build vibeApi (→ AppSessions, which wires the doc-changed emit) for every
  // route that renders the vibe-data iframe: the /vibe/ viewer AND the /chat/
  // editor. Gated on a real appSlug — a chat with no app yet gets no vibeApi.
  // Reactive via useLocation() above so a freshly-created chat (navigated to
  // /chat/<owner>/<appSlug> after openChat) picks up its vibeApi. (#2306)
  if (target !== undefined) {
    const appApiUrl = BuildURI.from(apiUrl)
      .pathname("/api/app")
      .cleanParams()
      .setParam("vibe", `${target.ownerHandle}--${target.appSlug}`)
      .toString();

    const capturedGetToken = sharedGetToken ?? realCtx.getToken;
    realCtx.vibeApi = vibesDiyApis.get(appApiUrl).once(() => {
      return new VibesDiyApi({
        apiUrl: appApiUrl,
        skipShard: true,
        getToken: capturedGetToken ?? (() => Promise.resolve(Result.Err("token not available"))),
      });
    });
  } else {
    realCtx.vibeApi = undefined;
  }
```

- [ ] **Step 4: Keep the chatApi shard hint consistent (no behavior change required)**

Leave the `chatApi` `shardKey` derivation at lines ~158-159 as-is (it pins the chat WS shard for `/vibe/` viewer routes only; that is orthogonal to the data-path fix). Do **not** widen it to `/chat/` — chat/codegen traffic intentionally keeps random-UUID load-balancing (see the comment at lines 152-157). This step is a no-op confirmation; record it as reviewed.

- [ ] **Step 5: Type-check the provider change**

Run: from repo root → `pnpm -C vibes.diy/pkg exec tsc --noEmit` (or the repo's standard `pnpm fast-check` if faster).
Expected: no new type errors from `vibes-diy-provider.tsx`. If `useLocation` is reported as an unused/duplicate import, reconcile with the existing import line.

- [ ] **Step 6: Commit**

```bash
git add vibes.diy/pkg/app/vibes-diy-provider.tsx
git commit -m "feat(provider): build vibeApi for the /chat/ editor route, reactive on navigation (#2306)"
```

---

## Task 3: srv-sandbox data handlers require vibeApi (typed error, no chatApi fallback)

**Files:**
- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` (9 handlers; add a `requireVibeApi` helper)
- Modify: `vibes.diy/api/tests/srv-sandbox-put-doc.test.ts`
- Modify: `vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts`
- Create: `vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts`

Nine data handlers currently use `const api = vibeApi ?? chatApi` — putDoc (L341), getDoc (L391), queryDocs (L430), deleteDoc (L468), subscribeDocs (L507), setDbAcl (L544), listDbNames (L581), putAsset (L628), whoAmI (L709) in [`srv-sandbox.ts`](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts). After Task 2 every iframe-rendering route supplies `vibeApi`, so the fallback is safe to remove. A missing `vibeApi` on a vibe-data path becomes a **typed bridge error** (CharlieHelps' choice: `status:"error"` envelope → maps to `Result.Err` on the runtime side) rather than a silent ChatSessions write that never emits.

The existing error envelope for each handler is `{ tid, type: "<res-type>", status: "error", message }` ([put-doc error path, srv-sandbox.ts:359-374](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts)). The reusable error constructor is `mkResError(message, code?)` from `api/types/common.ts`.

- [ ] **Step 1: Write the failing test for the missing-vibeApi path**

Create `vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts` (mirrors the harness in `srv-sandbox-put-doc.test.ts`):

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface } from "@vibes.diy/api-types";

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

function fakeMessageEvent(data: unknown, origin: string, source: Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

interface CapturedMsg {
  readonly data: unknown;
  readonly origin: string;
}

// chatApi is present (chat/codegen still needs it); vibeApi is intentionally absent.
function setupNoVibeApi(): { sandbox: vibesDiySrvSandbox; captured: CapturedMsg[]; iframe: Window; putDocCalls: { count: number } } {
  const captured: CapturedMsg[] = [];
  const iframe = { postMessage: (data: unknown, origin: string) => captured.push({ data, origin }) } as unknown as Window;
  const putDocCalls = { count: 0 };
  const fakeChatApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    putDoc: async () => {
      putDocCalls.count++; // MUST stay 0 — a missing vibeApi must NOT fall back to chatApi
      throw new Error("chatApi.putDoc should never be called on the vibe-data path");
    },
  };
  const sandbox = new vibesDiySrvSandbox({
    chatApi: fakeChatApi as VibesDiyApiIface,
    // vibeApi: undefined  <- the case under test
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
  return { sandbox, captured, iframe, putDocCalls };
}

describe("srv-sandbox vibe-data handlers require vibeApi", () => {
  it("putDoc with no vibeApi returns a typed error and never touches chatApi", async () => {
    const { sandbox, captured, iframe, putDocCalls } = setupNoVibeApi();
    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibes.diy.req-put-doc", tid: "t1", appSlug: "myapp", ownerHandle: "alice", dbName: "notes", doc: { title: "hi" } },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(putDocCalls.count).toBe(0);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-put-doc");
    expect(msg?.data).toMatchObject({ tid: "t1", type: "vibes.diy.res-put-doc", status: "error" });
    expect((msg?.data as { message?: string }).message ?? "").toMatch(/vibeApi/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: from `vibes.diy/api/tests/` → `pnpm test -- srv-sandbox-require-vibe-api.test.ts`
Expected: FAIL — currently `putDoc` falls back to `chatApi`, so `putDocCalls.count` is 1 and the thrown "should never be called" error surfaces (or no `res-put-doc` error envelope is posted).

- [ ] **Step 3: Add the `requireVibeApi` helper**

In `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`, near the top of the handler definitions (after imports, before the first handler), add a helper that returns the vibeApi or posts a typed error and signals the handler to stop. Match the existing `ctx.send.send(...)` shape used by each handler. Sketch (adapt types to the file's `EventoHandler`/`ctx` types):

```ts
// Vibe document data + DB subscriptions must ride AppSessions (vibeApi), which
// wires the doc-changed emit. A missing vibeApi is a hard error, never a silent
// fallback to chatApi (ChatSessions) — that fallback was the #2306 leak.
async function requireVibeApi(
  sandbox: vibesDiySrvSandbox,
  ctx: HandleTriggerCtx<MessageEvent, { tid: string }, unknown>,
  resType: string
): Promise<VibesDiyApiIface | undefined> {
  const { vibeApi } = sandbox.args;
  if (vibeApi !== undefined) return vibeApi;
  await ctx.send.send(ctx, {
    tid: ctx.validated.tid,
    type: resType,
    status: "error",
    message: "vibeApi unavailable — vibe data requires an app session",
  });
  return undefined;
}
```

(Keep the exact `type` literal each handler already sends, e.g. `"vibes.diy.res-put-doc"`. Use the handler's own `ResX` type for the satisfies clause where the surrounding code does.)

- [ ] **Step 4: Migrate each of the 9 data handlers**

In each of putDoc, getDoc, queryDocs, deleteDoc, subscribeDocs, setDbAcl, listDbNames, putAsset, whoAmI, replace:

```ts
const api = vibeApi ?? chatApi;
```

with a require-then-use, e.g. for `vibePutDoc`:

```ts
const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-put-doc");
if (api === undefined) return Result.Ok(EventoResult.Stop);
```

Use each handler's own response `type` literal in the `requireVibeApi` call. Where a handler currently destructures `const { vibeApi, chatApi } = sandbox.args;` at the top, drop the now-unused `chatApi` from that destructure (the data handlers no longer use it). Leave the response-building code below unchanged — it already references `api`.

- [ ] **Step 5: Update existing handler tests to supply vibeApi**

In `vibes.diy/api/tests/srv-sandbox-put-doc.test.ts` and `srv-sandbox-set-db-acl.test.ts`, the `setupSandbox` builds the sandbox with only `chatApi`. The migrated handlers now use `vibeApi`. Change the fake so the data-op fake (`putDoc` / `setDbAcl`) is supplied on a `vibeApi` and pass it into the constructor:

```ts
const sandbox = new vibesDiySrvSandbox({
  chatApi: fakeApi as VibesDiyApiIface,
  vibeApi: fakeApi as VibesDiyApiIface, // data ops now ride vibeApi
  errorLogger: (message) => {
    errorLogs.push(message);
  },
  eventListeners: { addEventListener: () => {}, removeEventListener: () => {} },
});
```

(Reuse the same `fakeApi` object for both — its `onDocChanged`/`putDoc`/`setDbAcl` stubs serve either role. The assertions about error copy and posted envelopes are unchanged.)

- [ ] **Step 6: Run the srv-sandbox handler tests**

Run: from `vibes.diy/api/tests/` →
`pnpm test -- srv-sandbox-require-vibe-api.test.ts srv-sandbox-put-doc.test.ts srv-sandbox-set-db-acl.test.ts`
Expected: PASS — the new require test passes (count 0, typed error with `/vibeApi/i`), and the two existing tests still pass with `vibeApi` supplied.

- [ ] **Step 7: Commit**

```bash
git add vibes.diy/vibe/srv-sandbox/srv-sandbox.ts \
  vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts \
  vibes.diy/api/tests/srv-sandbox-put-doc.test.ts \
  vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts
git commit -m "fix(srv-sandbox): vibe data requires vibeApi, no silent ChatSessions fallback (#2306)"
```

---

## Task 4: Move imgGen to vibeApi

**Files:**
- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` (`vibeImgGen`, L273-335)
- Modify: `vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts` (add imgGen case)

`vibeImgGen` ([srv-sandbox.ts:274](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts)) destructures `const { chatApi } = sandbox.args;` and calls `chatApi.openChat({ ..., mode: "img" })`. Image generation is vibe-scoped, so per maintainer direction it moves to `vibeApi`. `callAI` (L167) and `updateAvatarCid` (L748) **stay on `chatApi`** (CharlieHelps: LLM/billing and user-settings scoped) — do not touch them.

- [ ] **Step 1: Add the failing imgGen test case**

Append to `describe("srv-sandbox vibe-data handlers require vibeApi", ...)` in `srv-sandbox-require-vibe-api.test.ts`:

```ts
it("imgGen with no vibeApi returns a typed error", async () => {
  const { sandbox, captured, iframe } = setupNoVibeApi();
  sandbox.handleMessage(
    fakeMessageEvent(
      { type: "vibes.diy.req-img-gen", tid: "g1", appSlug: "myapp", ownerHandle: "alice", prompt: "a cat" },
      "https://myapp--alice.example.com",
      iframe
    )
  );
  await new Promise((r) => setTimeout(r, 50));
  const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.imgGen");
  expect(msg?.data).toMatchObject({ tid: "g1", type: "vibe.res.imgGen", status: "error" });
});
```

Before relying on the `req-img-gen` `type` literal and request fields, confirm them against `isReqImgGen` / `ReqImgGen` (grep the `@vibes.diy/api-types` definition used at [srv-sandbox.ts:273](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts)); use the exact request `type` string and required fields the validator expects so `validate` returns `Some`.

- [ ] **Step 2: Run test to verify it fails**

Run: from `vibes.diy/api/tests/` → `pnpm test -- srv-sandbox-require-vibe-api.test.ts`
Expected: FAIL on the imgGen case — `imgGen` still uses `chatApi`, so with no `vibeApi` it either calls `chatApi.openChat` (and may not post a `vibe.res.imgGen` error) rather than short-circuiting.

- [ ] **Step 3: Move imgGen to vibeApi with the require guard**

In `vibeImgGen`, replace `const { chatApi } = sandbox.args;` with the require-guard inside the handler body (before the `openChat` call), so the transport is `vibeApi`:

```ts
// inside handle(), before building sendErr/sendOk usage of the api:
const api = await requireVibeApi(sandbox, ctx, "vibe.res.imgGen");
if (api === undefined) return Result.Ok(EventoResult.Stop);
```

Then change the `chatApi.openChat({ ..., mode: "img" })` call to `api.openChat({ ..., mode: "img" })`. Leave `sendErr`/`sendOk` and the file-extraction logic unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: from `vibes.diy/api/tests/` → `pnpm test -- srv-sandbox-require-vibe-api.test.ts`
Expected: PASS (putDoc + imgGen cases).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/srv-sandbox/srv-sandbox.ts vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts
git commit -m "fix(srv-sandbox): route imgGen through vibeApi (AppSessions) (#2306)"
```

---

## Task 5: Remove the dead chatApi.onDocChanged registration

**Files:**
- Modify: `vibes.diy/vibe/srv-sandbox/srv-sandbox.ts` (constructor, L931-964)

The constructor registers `this.args.chatApi.onDocChanged(...)` **unconditionally**, then conditionally registers `vibeApi.onDocChanged(...)` ([srv-sandbox.ts:956-962](../../../vibes.diy/vibe/srv-sandbox/srv-sandbox.ts)). ChatSessions never emits doc-changed, so the `chatApi` registration is dead — and keeping it forwards nothing while implying live sync works. Remove it; keep only the `vibeApi` registration. This is also one of CharlieHelps' five preconditions for the eventual compile-time flip ("no `chatApi.onDocChanged` forwarding remains").

- [ ] **Step 1: Write the failing test — chatApi.onDocChanged must not be registered**

Append to `srv-sandbox-require-vibe-api.test.ts` a test that constructs a sandbox and asserts the chatApi's `onDocChanged` was never subscribed while vibeApi's was:

```ts
it("does not register a chatApi.onDocChanged forwarder (dead path)", () => {
  let chatOnDocChangedCalls = 0;
  let vibeOnDocChangedCalls = 0;
  const fakeChatApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => {
      chatOnDocChangedCalls++;
      return () => {};
    },
  };
  const fakeVibeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => {
      vibeOnDocChangedCalls++;
      return () => {};
    },
  };
  // eslint-disable-next-line no-new
  new vibesDiySrvSandbox({
    chatApi: fakeChatApi as VibesDiyApiIface,
    vibeApi: fakeVibeApi as VibesDiyApiIface,
    errorLogger: () => {},
    eventListeners: { addEventListener: () => {}, removeEventListener: () => {} },
  });
  expect(chatOnDocChangedCalls).toBe(0);
  expect(vibeOnDocChangedCalls).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: from `vibes.diy/api/tests/` → `pnpm test -- srv-sandbox-require-vibe-api.test.ts`
Expected: FAIL — `chatOnDocChangedCalls` is currently 1 (unconditional registration).

- [ ] **Step 3: Remove the dead registration**

In the constructor, delete the unconditional block:

```ts
this.args.chatApi.onDocChanged((ownerHandle, appSlug, dbName, docId) => {
  this.forwardDocChangedToIframe(ownerHandle, appSlug, dbName, docId);
});
```

Keep the `if (this.args.vibeApi !== undefined) { this.args.vibeApi.onDocChanged(...) }` block.

- [ ] **Step 4: Run test to verify it passes**

Run: from `vibes.diy/api/tests/` → `pnpm test -- srv-sandbox-require-vibe-api.test.ts`
Expected: PASS (`chatOnDocChangedCalls` 0, `vibeOnDocChangedCalls` 1, plus the earlier cases).

- [ ] **Step 5: Commit**

```bash
git add vibes.diy/vibe/srv-sandbox/srv-sandbox.ts vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts
git commit -m "refactor(srv-sandbox): drop dead chatApi.onDocChanged forwarder (#2306)"
```

---

## Task 6: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Prettier the changed files**

Run from repo root:

```bash
npx prettier --write \
  vibes.diy/pkg/app/vibe-api-target.ts \
  vibes.diy/tests/app/vibe-api-target.test.ts \
  vibes.diy/pkg/app/vibes-diy-provider.tsx \
  vibes.diy/vibe/srv-sandbox/srv-sandbox.ts \
  vibes.diy/api/tests/srv-sandbox-require-vibe-api.test.ts \
  vibes.diy/api/tests/srv-sandbox-put-doc.test.ts \
  vibes.diy/api/tests/srv-sandbox-set-db-acl.test.ts
```

- [ ] **Step 2: Run the full check**

Run from repo root: `pnpm check`
Expected: format + build + test + lint all green. If a known-flaky failure appears, rerun per `agents/flaky-tests.md` (issue #1515) before treating it as real.

- [ ] **Step 3: Confirm no remaining `vibeApi ?? chatApi` fallback in data handlers**

Run: `grep -n "vibeApi ?? chatApi" vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`
Expected: no matches (all 9 data handlers migrated). This is precondition #1 for the deferred compile-time flip.

- [ ] **Step 4: Confirm no remaining chatApi.onDocChanged registration**

Run: `grep -n "chatApi.onDocChanged" vibes.diy/vibe/srv-sandbox/srv-sandbox.ts`
Expected: no matches. This is precondition #2 for the deferred compile-time flip.

- [ ] **Step 5: Commit any prettier-only changes**

```bash
git add -A
git commit -m "chore: prettier pass for vibe-data-on-appsessions (#2306)" || echo "nothing to commit"
```

---

## Self-review notes (spec coverage)

- Spec step 1 (vibeApi for every iframe route, lazy on appSlug) → Tasks 1 + 2.
- Spec step 2 (srv-sandbox uses vibeApi only + typed error; remove dead onDocChanged) → Tasks 3 + 5.
- Spec step 3 (move imgGen to vibeApi) → Task 4.
- Spec step 4 (static/shared handler; ChatSessions connects only for chat) → **deferred** (separate PR; documented in the Scope note).
- Spec step 5 (compile-time flip of ChatSessions emit) → **deferred**, gated on CharlieHelps' five preconditions; this plan satisfies preconditions #1 (no `vibeApi ?? chatApi`) and #2 (no `chatApi.onDocChanged`).
- CharlieHelps Q3 (`callAI`/`updateAvatarCid` stay on chatApi) → honored (Task 4 touches imgGen only).
- CharlieHelps Q4 (typed bridge error, not throw) → honored (`requireVibeApi` posts a `status:"error"` envelope).

## Manual validation after merge (out-of-band, two live users)

The unit tests cannot prove live cross-user sync. After the branch deploys to `cli` (`vibes-diy@c*`), reproduce the #2306 repro: two browsers on a channel app (`useFireproof("quicknotes")`, access.js → channel `notes`), opened via the **`/chat/` editor**. A write in one browser must appear **live** (no reload) in the other. See the spec's "Evidence" section for the exact repro app shape.
