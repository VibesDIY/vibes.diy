# SharedSessions DO (Track B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight `SharedSessions` Durable Object that serves only `sharedHandlers`, make `chatApi` lazy, and turn `ChatSessions` chat-only, so every page opens a single eager WebSocket.

**Architecture:** `SharedSessions` is the non-vibe-plane DO. Authed reads ride a per-user shard (`userNotifyShardFor(userId)`); anonymous reads ride a `global` singleton; vibe pages keep using `vibeApi` (AppSessions already serves `sharedHandlers`). `UserNotify` stays the plane-agnostic fan-out hub; `SharedSessions` only holds the WS + registers the subscription via a new `shared:` shard prefix. The admin-mode `whoAmI` moves off `chatApi` onto the doc-op connection (`vibeApi`) because admin mode is a doc-plane concern, not chat.

**Tech Stack:** TypeScript, Cloudflare Durable Objects, `@adviser/cement` (Evento/Lazy/Result), arktype, Vitest, React, wrangler.

**Source spec:** [`docs/superpowers/specs/2026-06-22-shared-sessions-do-design.md`](../specs/2026-06-22-shared-sessions-do-design.md)

**Conventions for every task below:**

- Run the full check with `pnpm check` from repo root; run a single api test file with `cd vibes.diy/tests && pnpm test <path>` or `pnpm vitest run <path>` from the package that owns it. Confirm the actual runner with a maintainer if a command errors — do not assume.
- Format before committing: `npx prettier --write <changed files>` (CI runs `format:check`).
- Never push to `main`. Never hand-edit `package.json` versions.
- Commit messages: imperative subject; no model identifiers.

---

## File structure

**New files**

- `vibes.diy/api/svc/shared-msg-evento.ts` — the `SharedSessions` evento (`sharedHandlers` + WildCard/Error only).
- `vibes.diy/pkg/workers/shared-sessions.ts` — the `SharedSessions` DO class (WS + user-notify register/deliver, no QuickJS/doc ops).
- `vibes.diy/api/tests/shared-msg-evento.test.ts` — asserts the evento serves exactly `sharedHandlers`.

**Modified files**

- `vibes.diy/api/svc/evento-handler-manifest.ts` — move `listHandleBindings`/`createHandleBinding`/`deleteHandleBinding`, `getCertFromCsr`, and the 7 `report*` handlers from `chatHandlers` → `sharedHandlers`.
- `vibes.diy/api/svc/chat-msg-evento.ts` — `chatPlaneHandlers = [...chatHandlers]` (drop `...sharedHandlers`).
- `vibes.diy/api/tests/evento-handler-parity.test.ts` — flip the chat-plane contract to "no `sharedHandlers` in the chat plane"; assert re-homed handlers live in `sharedHandlers`.
- `vibes.diy/api/types/cf-env.ts` — add `SHARED_SESSIONS: DurableObjectNamespace`.
- `vibes.diy/pkg/workers/resolve-shard-do.ts` — add `shared:` prefix → `SHARED_SESSIONS`.
- `vibes.diy/api/tests/resolve-shard-do.test.ts` — add `shared:` cases.
- `vibes.diy/pkg/workers/route-decision.ts` — add `shared-do` route before `api-do`.
- `vibes.diy/tests/app/route-decision.test.ts` (or the existing route-decision test path) — add `shared-do` cases.
- `vibes.diy/pkg/workers/app.ts` — dispatch `shared-do`; export `SharedSessions`.
- `vibes.diy/pkg/wrangler.toml` — bind `SHARED_SESSIONS` + `v8 new_classes` in all six env blocks.
- `vibes.diy/pkg/app/vibes-diy-provider.tsx` — add `sharedApi`, lazy `chatApi`, remove standalone `notifyApi`.
- `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx` — admin `whoAmI` `chatApi` → `vibeApi`.
- Call sites listed in Phase 4 — migrate `chatApi.*` shared reads → `sharedApi.*`.

---

## Phase 1 — Lock `whoAmI` admin-mode on the doc-op connection

Admin mode is a doc-plane concern. `who-am-i.ts:209-211` sets a sticky per-connection `rawSend.adminMode` consumed by `putDoc` via `connectionAdminMode(ctx)`. Today `refreshViewerFromWhoAmI` issues the admin `whoAmI` on `chatApi` (`vibe.$ownerHandle.$appSlug.tsx:281`) while `putDoc` runs on `vibeApi` — a latent mis-coupling. Fix it before anything else so lazy-`chatApi` never interacts with admin authorization.

### Task 1.1: Failing test — admin `whoAmI` + `putDoc` share one connection

**Files:**

- Test: `vibes.diy/api/tests/who-am-i-admin-connection.test.ts` (Create)

- [ ] **Step 1: Read the existing admin-mode coverage** to reuse its harness.

Read `vibes.diy/api/tests/who-am-i.test.ts` (WS pair + `vibesMsgEvento` setup) and `docs/superpowers/specs/2026-06-09-owner-mode-data-tab-cli-design.md` (how `connectionAdminMode` reaches `putDoc`). Mirror the `TestWSPair` + `WSSendProvider` wiring from `who-am-i.test.ts:33-39`.

- [ ] **Step 2: Write the failing test.**

Drive a single `WSSendProvider` connection: call `vibe.whoAmI` with `adminMode: true`, then issue a `put-doc` on the **same** connection and assert the access fn observed `adminMode === true` (owner write succeeds in admin mode). The assertion is that the flag and the doc op are correlated on one connection — encode the contract, not the current wiring.

```ts
// who-am-i-admin-connection.test.ts — shape (fill in concrete payloads from
// who-am-i.test.ts + the put-doc handler's request type)
it("admin whoAmI sets connection adminMode that the same connection's putDoc reads", async () => {
  const { appCtx, conn, trigger } = setupSingleConnection(); // adapt from who-am-i.test.ts
  await trigger(conn, whoAmIReq({ appSlug, ownerHandle, adminMode: true }));
  expect(conn.adminMode).toBe(true); // rawSend.adminMode, who-am-i.ts:211
  const res = await trigger(
    conn,
    putDocReq({
      /* owner-gated doc */
    })
  );
  expect(isOkPutDoc(res)).toBe(true); // admin-mode write authorized on this connection
});
```

- [ ] **Step 3: Run it, expect a clear failure** (or pass if the harness already supports it — if it passes, that only proves the server contract; the client repoint in Task 1.2 is the real change). Run: `cd vibes.diy/tests && pnpm vitest run who-am-i-admin-connection`.

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/api/tests/who-am-i-admin-connection.test.ts
git commit -m "test: pin admin whoAmI + putDoc to one connection"
```

### Task 1.2: Repoint `refreshViewerFromWhoAmI` to `vibeApi`

**Files:**

- Modify: `vibes.diy/pkg/app/routes/vibe.$ownerHandle.$appSlug.tsx:281`

- [ ] **Step 1: Read the call site** (`vibe.$ownerHandle.$appSlug.tsx:274-301`) to confirm `vctx.vibeApi` is in scope inside `refreshViewerFromWhoAmI` and that this callback only runs on vibe routes (it early-returns when `!srvVibeSandbox || !ownerHandle || !appSlug`, so a vibe context with `vibeApi` is guaranteed).

- [ ] **Step 2: Change the connection** from `chatApi` to `vibeApi`, with a guarded fallback so a vibe page that somehow lacks `vibeApi` does not silently lose viewer refresh.

```tsx
// was: const rRes = await vctx.chatApi.whoAmI({
const conn = vctx.vibeApi ?? vctx.chatApi; // admin mode is a doc-plane concern → ride vibeApi
const rRes = await conn.whoAmI({
  tid: crypto.randomUUID(),
  appSlug,
  ownerHandle,
  adminMode: adminOverride ?? adminModeRef.current,
});
```

- [ ] **Step 3: Find any other admin-mode `whoAmI` callers.** Run a search and repoint each that passes `adminMode` to the doc-op connection:

Search: `chatApi.whoAmI` and `adminMode` across `vibes.diy/pkg/app`. Expected: the only `adminMode`-bearing caller is `refreshViewerFromWhoAmI`. Plain `whoAmI` (no `adminMode`) is left for Phase 4.

- [ ] **Step 4: Run the dependent UI/integration tests + typecheck.** Run: `pnpm check` (or the narrowest test that covers the vibe route). Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/pkg/app/routes/vibe.\$ownerHandle.\$appSlug.tsx
git commit -m "fix: ride admin whoAmI on vibeApi (doc-op connection), not chatApi"
```

**Exit gate:** `whoAmI` stays excluded from the Phase 4 blanket migration except the plain (non-admin) read. Do not proceed to Phase 5 (lazy chat) until this is green.

---

## Phase 2 — Re-home non-prompt handlers `chatHandlers` → `sharedHandlers`

These are stateless identity/settings/analytics D1 ops with no chat/QuickJS state, called from non-chat pages. They must move before `chatApi` goes lazy.

### Task 2.1: Failing parity test for the re-homed handlers

**Files:**

- Modify: `vibes.diy/api/tests/evento-handler-parity.test.ts`

- [ ] **Step 1: Add assertions** that the re-homed handlers are in `sharedHandlers` and NOT in `chatHandlers`. Append to the `describe` block:

```ts
it("identity/settings/report handlers are shared, not chat (Track B re-home)", () => {
  const shared = hashes(sharedHandlers);
  const chat = hashes(chatHandlers);
  const reHomed = [
    "list-user-slug-bindings",
    "create-user-slug-binding",
    "delete-user-slug-binding",
    "get-cert-from-csr",
    "vibes.diy.req-report-growth-memberships",
    "vibes.diy.req-report-growth-vibes-with-data",
    "vibes.diy.req-report-active-members",
    "vibes.diy.req-report-top-vibes-by-members",
    "vibes.diy.req-report-attribution-referrers",
    "vibes.diy.req-report-campaign-health",
    "vibes.diy.req-report-campaign-ad-previews",
  ];
  for (const h of reHomed) {
    expect(shared.has(h), `${h} must be a sharedHandler`).toBe(true);
    expect(chat.has(h), `${h} must NOT be a chatHandler`).toBe(false);
  }
});
```

- [ ] **Step 2: Run it, expect FAIL** (handlers are still in `chatHandlers`). Run: `cd vibes.diy/tests && pnpm vitest run evento-handler-parity`. Expected: FAIL on the first `expect(shared.has(...)).toBe(true)`.

- [ ] **Step 3: Commit the failing test.**

```bash
git add vibes.diy/api/tests/evento-handler-parity.test.ts
git commit -m "test: assert identity/report handlers re-home to sharedHandlers"
```

### Task 2.2: Move the handlers in the manifest

**Files:**

- Modify: `vibes.diy/api/svc/evento-handler-manifest.ts`

- [ ] **Step 1: Move the imports' usages into `sharedHandlers`.** In the `sharedHandlers` array (currently ends at `assetUploadGrantEvento`), add the re-homed entries; remove them from `chatHandlers`. The imports at the top already exist (`listHandleBindingsEvento`, `createHandleBindingEvento`, `deleteHandleBindingEvento`, `getCertFromCsrEvento`, and the 7 `report*Evento`); only the array membership changes.

Add to `sharedHandlers` (after `assetUploadGrantEvento`):

```ts
  // Re-homed from chatHandlers (#2265 Track B): stateless identity/settings/
  // analytics D1 ops called from non-chat pages (settings, messages, reporting
  // dashboard). Moving them here lets chatApi go lazy without stranding callers.
  listHandleBindingsEvento,
  createHandleBindingEvento,
  deleteHandleBindingEvento,
  getCertFromCsrEvento,
  reportGrowthMembershipsEvento,
  reportGrowthVibesWithDataEvento,
  reportActiveMembersEvento,
  reportTopVibesByMembersEvento,
  reportAttributionReferrersEvento,
  reportCampaignHealthEvento,
  reportCampaignAdPreviewsEvento,
```

- [ ] **Step 2: Remove those same 11 entries from the `chatHandlers` array.** After the edit, `chatHandlers` is: `ensureAppSlugItemEvento`, `openChat`, `promptChatSection`, `getChatDetailsEvento`, `listApplicationChats`, `forkAppEvento`, `setModeFsIdEvento`.

- [ ] **Step 3: Run the parity test, expect PASS.** Run: `cd vibes.diy/tests && pnpm vitest run evento-handler-parity`. Expected: PASS (including the unchanged "no handler in more than one category" + "unique hash" tests).

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/api/svc/evento-handler-manifest.ts
git commit -m "refactor: re-home identity/settings/report handlers to sharedHandlers"
```

---

## Phase 3 — Server shared-plane plumbing

### Task 3.1: `SHARED_SESSIONS` in the env type

**Files:**

- Modify: `vibes.diy/api/types/cf-env.ts:39-41`

- [ ] **Step 1: Add the binding** next to the other DO namespaces:

```ts
CHAT_SESSIONS: DurableObjectNamespace;
APP_SESSIONS: DurableObjectNamespace;
SHARED_SESSIONS: DurableObjectNamespace;
USER_NOTIFY: DurableObjectNamespace;
```

- [ ] **Step 2: Typecheck.** Run: `pnpm check` (build only is fine if faster). Expected: PASS (no consumer requires it yet).

- [ ] **Step 3: Commit.**

```bash
git add vibes.diy/api/types/cf-env.ts
git commit -m "feat: add SHARED_SESSIONS env binding type"
```

### Task 3.2: `resolve-shard-do` `shared:` prefix (fan-out routing)

**Files:**

- Modify: `vibes.diy/pkg/workers/resolve-shard-do.ts`
- Modify: `vibes.diy/api/tests/resolve-shard-do.test.ts`

- [ ] **Step 1: Write failing tests.** Add to `resolve-shard-do.test.ts`:

```ts
const SHARED_SESSIONS = { sentinel: "SHARED_SESSIONS" } as unknown as CFEnv["SHARED_SESSIONS"];
// extend the env literal: const env = { APP_SESSIONS, CHAT_SESSIONS, SHARED_SESSIONS } as unknown as CFEnv;

it("shared:foo → SHARED_SESSIONS with name 'foo'", () => {
  const result = resolveShardDO("shared:foo", env);
  expect(result.ns).toBe(SHARED_SESSIONS);
  expect(result.name).toBe("foo");
});

it("shared:notify-user-abc → SHARED_SESSIONS with the user shard name", () => {
  const result = resolveShardDO("shared:notify-user-abc", env);
  expect(result.ns).toBe(SHARED_SESSIONS);
  expect(result.name).toBe("notify-user-abc");
});
```

- [ ] **Step 2: Run, expect FAIL** (`shared` is an unknown prefix → currently falls to `CHAT_SESSIONS`). Run: `cd vibes.diy/tests && pnpm vitest run resolve-shard-do`. Expected: FAIL (`ns` is `CHAT_SESSIONS`).

- [ ] **Step 3: Add the prefix binding** in `resolve-shard-do.ts`:

```ts
const SHARD_PREFIX_BINDINGS: Record<string, keyof Pick<CFEnv, "APP_SESSIONS" | "SHARED_SESSIONS">> = {
  app: "APP_SESSIONS",
  shared: "SHARED_SESSIONS",
};
```

- [ ] **Step 4: Run, expect PASS.** Run: `cd vibes.diy/tests && pnpm vitest run resolve-shard-do`. Expected: PASS (existing 5 cases + 2 new).

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/pkg/workers/resolve-shard-do.ts vibes.diy/api/tests/resolve-shard-do.test.ts
git commit -m "feat: route shared: shard prefix to SHARED_SESSIONS"
```

### Task 3.3: `shared-do` route decision

**Files:**

- Modify: `vibes.diy/pkg/workers/route-decision.ts`
- Modify: the route-decision test (find it: `grep -rl routeDecision vibes.diy/**/tests vibes.diy/tests`)

- [ ] **Step 1: Write failing tests** in the route-decision test file:

```ts
it("/api/shared → shared-do", () => {
  expect(routeDecision({ ...base, pathname: "/api/shared", method: "GET" })).toBe("shared-do");
});
it("/api/shared/ → shared-do", () => {
  expect(routeDecision({ ...base, pathname: "/api/shared/x", method: "GET" })).toBe("shared-do");
});
it("/api/other still → api-do", () => {
  expect(routeDecision({ ...base, pathname: "/api/other", method: "GET" })).toBe("api-do");
});
```

(Use the same `base` RouteInput shape the existing cases use — `hostname`, `hostnameBase`, etc.)

- [ ] **Step 2: Run, expect FAIL** (`/api/shared` currently matches `api-do`). Expected: FAIL (returns `"api-do"`).

- [ ] **Step 3: Add the route.** In `route-decision.ts`, add `"shared-do"` to the `Route` union (with a comment) and match it **before** the generic `/api/` branch:

```ts
// in the Route union:
  | "shared-do" // /api/shared → SharedSessions DO (singleton/per-user shared-plane WS)

// in routeDecision(), BEFORE the `/api` / `/api/` check (which is before app-api? no —
// app-api is checked first; place shared-do immediately after app-api, before api-do):
  if (pathname === "/api/shared" || pathname.startsWith("/api/shared/")) {
    return "shared-do";
  }
```

Place it right after the `app-api` block (line 33-35) and before the `api-do` block (line 36-38).

- [ ] **Step 4: Run, expect PASS.** Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/pkg/workers/route-decision.ts <route-decision test path>
git commit -m "feat: add /api/shared route decision before /api/*"
```

### Task 3.4: The `SharedSessions` evento

**Files:**

- Create: `vibes.diy/api/svc/shared-msg-evento.ts`
- Create: `vibes.diy/api/tests/shared-msg-evento.test.ts`

- [ ] **Step 1: Write the failing test** asserting the evento serves exactly `sharedHandlers` (plus WildCard/Error), no chat/app handlers:

```ts
import { describe, expect, it } from "vitest";
import { sharedMsgEvento } from "../svc/shared-msg-evento.js";
import { sharedHandlers, appHandlers, chatHandlers } from "../svc/evento-handler-manifest.js";

function actionSet(handlers: readonly { hash: string }[]) {
  return new Set(handlers.map((h) => h.hash));
}

describe("sharedMsgEvento", () => {
  it("serves every sharedHandler", () => {
    const served = new Set(
      sharedMsgEvento()
        .handlers()
        .map((h: { hash: string }) => h.hash)
    );
    for (const h of actionSet(sharedHandlers)) expect(served.has(h), `missing ${h}`).toBe(true);
  });
  it("serves no app or chat handler", () => {
    const served = new Set(
      sharedMsgEvento()
        .handlers()
        .map((h: { hash: string }) => h.hash)
    );
    for (const h of actionSet(appHandlers)) expect(served.has(h), `leaked app ${h}`).toBe(false);
    for (const h of actionSet(chatHandlers)) expect(served.has(h), `leaked chat ${h}`).toBe(false);
  });
});
```

(Confirm the Evento accessor name — `app-session-chat-stopgap.test.ts:12` uses `appMsgEvento().handlers()`; mirror it.)

- [ ] **Step 2: Run, expect FAIL** (module does not exist). Run: `cd vibes.diy/tests && pnpm vitest run shared-msg-evento`. Expected: FAIL "Cannot find module".

- [ ] **Step 3: Create `shared-msg-evento.ts`** mirroring `chat-msg-evento.ts` but with only `sharedHandlers`:

```ts
import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";
import { sharedHandlers } from "./evento-handler-manifest.js";

// SharedSessions is the non-vibe-plane DO: stateless user/identity reads only
// (sharedHandlers). No doc ops, no chat streaming, no local QuickJS. (#2265 Track B)
export const sharedMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    ...sharedHandlers,
    {
      type: EventoType.WildCard,
      hash: "shared-not-msg-implemented-handler",
      handle: async (ctx) => {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Not Implemented: ${JSON.stringify(ctx.enRequest)}` },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    },
    {
      type: EventoType.Error,
      hash: "shared-error-handler",
      handle: async (ctx) => {
        console.error("sharedMsgEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Error: ${ctx.error?.message?.toString() || "Internal Server Error"}` },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      },
    }
  );
  return evento;
});
```

- [ ] **Step 4: Export it** if the package uses a barrel (`grep -n "chat-msg-evento" vibes.diy/api/svc/index.ts` — if `chatMsgEvento` is re-exported there, add `sharedMsgEvento` the same way).

- [ ] **Step 5: Run, expect PASS.** Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add vibes.diy/api/svc/shared-msg-evento.ts vibes.diy/api/tests/shared-msg-evento.test.ts
git commit -m "feat: add sharedMsgEvento (sharedHandlers only)"
```

### Task 3.5: The `SharedSessions` DO class

**Files:**

- Create: `vibes.diy/pkg/workers/shared-sessions.ts`

- [ ] **Step 1: Create the DO** by adapting `chat-sessions.ts`: keep the `POST /user-notify` delivery loop and the `userNotifyCallbacksForChatSessions` gating, but (a) serve `sharedMsgEvento`, (b) register the subscription under a `shared:` prefix so `UserNotify` fan-out resolves back via `resolveShardDO`, (c) drop the local QuickJS (`invokeAccessFn`) — SharedSessions never evaluates access fns.

```ts
// vibes.diy/pkg/workers/shared-sessions.ts
import {
  DurableObject,
  WebSocketPair as WebSocketPairType,
  WebSocket as CFWebSocket,
  ExecutionContext,
  Request as CFRequest,
  Response as CFResponse,
  CacheStorage,
  DurableObjectState,
} from "@cloudflare/workers-types";
import { CfCacheIf, cfServe } from "@vibes.diy/api-svc";
import { WSSendProvider } from "@vibes.diy/api-svc/svc-ws-send-provider.js";
import { CFInjectMutable, cfServeAppCtx } from "@vibes.diy/api-svc/cf-serve.js";
import { sharedMsgEvento } from "@vibes.diy/api-svc/shared-msg-evento.js";
import { CFEnv, isBuildNotification, isUserNotifyShard, userNotifyShardFor } from "@vibes.diy/api-types";
import { exception2Result, URI } from "@adviser/cement";
import { type } from "arktype";

const UserNotifyEvtShape = type({
  type: "'vibes.diy.evt-user-notification'",
  notificationType: "string",
  ownerHandle: "string",
  appSlug: "string",
});
const UserNotifyDelivery = type({ evt: UserNotifyEvtShape, senderConnId: "string", targetUserId: "string" });

declare const caches: CacheStorage;
declare const Response: typeof CFResponse;
declare const WebSocketPair: typeof WebSocketPairType;

function cfWebSocketPair(): { client: WebSocket; server: WebSocket } {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];
  return { client: client as unknown as WebSocket, server: server as unknown as WebSocket };
}

// Same bounded-registration gate as ChatSessions, but registers under a
// `shared:` shardId so UserNotify fan-out resolves back to SHARED_SESSIONS via
// resolveShardDO. Only the stable per-user notify shard may register.
function userNotifyCallbacksForSharedSessions(shard: string, env: CFEnv) {
  if (!isUserNotifyShard(shard)) return {};
  const shardId = `shared:${shard}`;
  function fetchUserNotify(userId: string, body: Record<string, unknown>): Promise<CFResponse> {
    const id = env.USER_NOTIFY.idFromName(userId);
    return env.USER_NOTIFY.get(id).fetch(
      new Request("https://internal/user-notify", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFRequest
    );
  }
  return {
    registerUserSubscription: async (userId: string): Promise<void> => {
      if (shard !== userNotifyShardFor(userId)) {
        console.warn("[SharedSessions] skip user-notify register: shard mismatch", shard.slice(0, 16));
        return;
      }
      await fetchUserNotify(userId, { action: "register", shardId });
    },
    deregisterUserSubscription: async (userId: string): Promise<void> => {
      if (shard !== userNotifyShardFor(userId)) return;
      await fetchUserNotify(userId, { action: "deregister", shardId });
    },
  };
}

export class SharedSessions implements DurableObject {
  private connections: Set<WSSendProvider> = new Set<WSSendProvider>();
  private env: CFEnv;
  constructor(_state: DurableObjectState, env: CFEnv) {
    this.env = env;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method === "POST") {
      const url = URI.from(request.url);
      if (url.pathname === "/user-notify") {
        const rJson = await exception2Result(() => request.json());
        if (rJson.isErr()) return new Response("Invalid JSON", { status: 400 });
        const parsed = UserNotifyDelivery(rJson.Ok());
        if (parsed instanceof type.errors) return new Response("Invalid notification", { status: 400 });
        const { evt, senderConnId, targetUserId } = parsed;
        let delivered = 0;
        for (const conn of this.connections) {
          if (conn.subscribedUserKey !== targetUserId) continue;
          if (!isBuildNotification(evt.notificationType) && conn.connId === senderConnId) continue;
          exception2Result(() =>
            conn.ws.send(
              conn.ende.uint8ify({
                tid: crypto.randomUUID(),
                src: "vibes.diy.api",
                dst: "vibes.diy.client",
                ttl: 10,
                payload: evt,
              })
            )
          );
          delivered++;
        }
        console.log(
          "[SharedSessions] user-notify",
          evt.notificationType,
          evt.ownerHandle + "/" + evt.appSlug,
          "| delivered to",
          delivered
        );
        return new Response("ok");
      }
      return new Response("unknown POST", { status: 400 });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") return new Response("Expected WebSocket", { status: 426 });

    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    (cctx as CFInjectMutable).cache = caches.default as unknown as CfCacheIf;
    cctx.webSocket = { connections: this.connections, webSocketPair: cfWebSocketPair };
    const shard = URI.from(request.url).getParam("shard");
    const userCbs = shard !== undefined ? userNotifyCallbacksForSharedSessions(shard, this.env) : {};
    cctx.appCtx = (await cfServeAppCtx(request, this.env, cctx, { ...userCbs })).appCtx;
    return cfServe(request, cctx, sharedMsgEvento);
  }
}
```

- [ ] **Step 2: Typecheck.** Run: `pnpm check` (build). Expected: PASS. If `cfServeAppCtx` requires `invokeAccessFn`/`broadcast` callbacks, check `app-sessions.ts:159-166` and pass the minimal set the type demands (SharedSessions needs neither broadcast nor access-fn — if the type forces them, supply no-op stubs and add a `// SharedSessions never broadcasts/evaluates` comment).

- [ ] **Step 3: Commit.**

```bash
git add vibes.diy/pkg/workers/shared-sessions.ts
git commit -m "feat: add SharedSessions DO (sharedHandlers + user-notify WS)"
```

### Task 3.6: Wire the DO into the worker (`app.ts`)

**Files:**

- Modify: `vibes.diy/pkg/workers/app.ts:30-32` (exports) and `:125` (dispatch)

- [ ] **Step 1: Export the class** next to the others:

```ts
export { ChatSessions } from "./chat-sessions.js";
export { AppSessions } from "./app-sessions.js";
export { SharedSessions } from "./shared-sessions.js";
export { UserNotify } from "./user-notify.js";
```

- [ ] **Step 2: Add dispatch** for `shared-do`, before the `api-do` block (`:125`):

```ts
if (route === "shared-do") {
  const shard = url.getParam("shard");
  const id = shard ? env.SHARED_SESSIONS.idFromName(shard) : env.SHARED_SESSIONS.idFromName("global");
  return env.SHARED_SESSIONS.get(id).fetch(request);
}
```

- [ ] **Step 3: Typecheck + run any worker dispatch test.** Run: `pnpm check`. Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/pkg/workers/app.ts
git commit -m "feat: dispatch /api/shared to SharedSessions (global or per-user shard)"
```

### Task 3.7: wrangler bindings + `v8` migration

**Files:**

- Modify: `vibes.diy/pkg/wrangler.toml` (six env blocks: default top, `env.local`, `env.dev`, `env.preview`, `env.prod`, `env.cli`)

- [ ] **Step 1: Add the binding** to each `durable_objects.bindings` list. For the top/local/dev/preview/prod blocks (local class), add:

```toml
  { name = "SHARED_SESSIONS", class_name = "SharedSessions" },
```

For `env.cli.durable_objects.bindings`, mirror `APP_SESSIONS`/`USER_NOTIFY` (cross-script to prod):

```toml
  { name = "SHARED_SESSIONS", class_name = "SharedSessions", script_name = "vibes-diy-v2-prod" },
```

- [ ] **Step 2: Add the `v8` migration** to every env block's migration list (after each `v7`):

```toml
[[migrations]]
tag = "v8"
new_classes = ["SharedSessions"]
```

…and the env-scoped equivalents (`[[env.local.migrations]]`, `[[env.dev.migrations]]`, `[[env.preview.migrations]]`, `[[env.prod.migrations]]`, `[[env.cli.migrations]]`) each with `tag = "v8"` / `new_classes = ["SharedSessions"]`. Mirror exactly how `v5`/`AppSessions` is declared per block (cli included).

- [ ] **Step 3: Dry-run every env** (do NOT deploy here). Run per env, e.g.:

```bash
cd vibes.diy/pkg && npx wrangler deploy --dry-run --env prod && \
npx wrangler deploy --dry-run --env cli && \
npx wrangler deploy --dry-run --env preview && \
npx wrangler deploy --dry-run --env dev
```

Expected: each prints a successful dry-run (no class-registry / 10074 / 10061 errors). If `--env` names differ, confirm with `grep "^\[env\." vibes.diy/pkg/wrangler.toml`.

- [ ] **Step 4: Commit.**

```bash
git add vibes.diy/pkg/wrangler.toml
git commit -m "chore: bind SHARED_SESSIONS + v8 migration in all envs"
```

**Release gate (executed at rollout, not in this plan):** deploy `prod` before `cli` — cli's cross-script `SHARED_SESSIONS` binding requires the prod class to exist first (same 10061 ordering as USER_NOTIFY).

---

## Phase 4 — Client wiring migration (route-by-route)

`sharedApi` resolves by route + auth: vibe route → `vibeApi`; non-vibe authed → SharedSessions per-user shard; non-vibe anon → SharedSessions `global`. Call sites use `sharedApi` and don't care which.

### Task 4.1: Add `sharedApi` to the context + resolver

**Files:**

- Modify: `vibes.diy/pkg/app/vibes-diy-provider.tsx` (`VibesDiyCtx` ~`:46-57`, builders ~`:253-298`)

- [ ] **Step 1: Add a `sharedReadShardFor` helper** (new file `vibes.diy/pkg/app/shared-read-shard.ts`) so the sharding seam is one isolated, testable function:

```ts
import { userNotifyShardFor } from "@vibes.diy/api-types";
// Authed reads ride the user's own shard (same as notifications); anon reads
// ride the `global` singleton. Single seam to later re-bucket `global`. (#2265 Track B)
export function sharedReadShardFor(userId: string | undefined): string {
  return userId ? userNotifyShardFor(userId) : "global";
}
```

- [ ] **Step 2: Write a unit test** `vibes.diy/tests/app/shared-read-shard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sharedReadShardFor } from "~/vibes.diy/app/shared-read-shard.js";
import { userNotifyShardFor } from "@vibes.diy/api-types";

describe("sharedReadShardFor", () => {
  it("anon → global", () => expect(sharedReadShardFor(undefined)).toBe("global"));
  it("authed → userNotifyShardFor", () => expect(sharedReadShardFor("user_1")).toBe(userNotifyShardFor("user_1")));
});
```

Run: `cd vibes.diy/tests && pnpm vitest run shared-read-shard`. Expected: PASS. (Confirm the `~/vibes.diy/app/...` import alias from a neighbouring test, e.g. `vibe-api-target.test.ts:2`.)

- [ ] **Step 3: Add `sharedApi` to `VibesDiyCtx`** (`:49-57`):

```ts
  chatApi: VibesDiyApiIface; // becomes a lazy getter in Phase 5
  vibeApi?: VibesDiyApiIface;
  // Non-vibe-plane shared reads (+ notify on non-vibe pages). On vibe routes
  // this is vibeApi; otherwise a SharedSessions connection (per-user or global).
  sharedApi: VibesDiyApiIface;
```

- [ ] **Step 4: Build the SharedSessions connection + resolve `sharedApi`.** Replace the `notifyApi` block (`:271-298`) with shared-plane construction. On vibe routes `sharedApi = vibeApi`; otherwise build a SharedSessions WS at `/api/shared?shard=<sharedReadShardFor(userId)>` and use it for both reads and notify:

```tsx
const buildSharedApi = (shard: string): VibesDiyApiIface => {
  const sharedUrl = BuildURI.from(apiUrl).pathname("/api/shared").cleanParams().setParam("shard", shard).toString();
  const capturedGetToken = sharedGetToken ?? realCtx.getToken;
  return vibesDiyApis.get(sharedUrl).once(
    () =>
      new VibesDiyApi({
        apiUrl: sharedUrl,
        skipShard: true, // shard is already in the URL; do not append a random one
        getToken: capturedGetToken ?? (() => Promise.resolve(Result.Err("token not available"))),
      })
  ) as VibesDiyApiIface;
};

if (target !== undefined) {
  realCtx.vibeApi = buildAppApi(`${target.ownerHandle}--${target.appSlug}`);
  realCtx.sharedApi = realCtx.vibeApi; // vibeApi already serves sharedHandlers
  realCtx.notifyApi = undefined;
} else {
  realCtx.vibeApi = undefined;
  realCtx.sharedApi = buildSharedApi(sharedReadShardFor(clerk.user?.id));
  realCtx.notifyApi = undefined; // notify rides sharedApi now
}
```

(Confirm `skipShard` + URL-embedded `shard` interact correctly — read `vibes.diy/api/impl/index.ts` for `skipShard`. If `skipShard` strips the param, instead keep `shardKey: shard` like the old `notifyApi` did at `:288-293`, pointed at `apiUrl` with `pathname("/api/shared")`.)

- [ ] **Step 5: Update the context object** passed to the provider value (`:316-317`) and the sandbox (`:316`) to include `sharedApi`. Keep `chatApi` for now (Phase 5 makes it lazy).

- [ ] **Step 6: Point notifications at `sharedApi`.** Update `useBuildCompletionNotifications` to subscribe `vibeApi ?? sharedApi` (read it first):

Read `vibes.diy/pkg/app/hooks/useBuildCompletionNotifications.ts`; replace its `vibeApi ?? notifyApi` selection with `vibeApi ?? sharedApi`. Run its test if present.

- [ ] **Step 7: Typecheck + run notification tests.** Run: `pnpm check`. Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add vibes.diy/pkg/app/vibes-diy-provider.tsx vibes.diy/pkg/app/shared-read-shard.ts \
  vibes.diy/tests/app/shared-read-shard.test.ts vibes.diy/pkg/app/hooks/useBuildCompletionNotifications.ts
git commit -m "feat: add sharedApi (SharedSessions per-user/global), notify rides it"
```

### Task 4.2: Migrate shared-read call sites `chatApi.*` → `sharedApi.*`

Do these **one route at a time**, each its own commit, so a regression bisects to one screen. For each: read the file, swap `chatApi` → `sharedApi` (or `vctx.chatApi` → `vctx.sharedApi`) for the shared-handler calls only, then run that screen's test.

- [ ] **Step 1: Enumerate call sites.** Run: `grep -rn "chatApi\.\(listHandleBindings\|listRecentVibes\|listMemberships\|listModels\|ensureUserSettings\|listDmThreads\|whoAmI\|listRequestGrants\|createInvite\|getCertFromCsr\|assetUploadGrant\|reportGrowth\|reportActive\|reportTop\|reportAttribution\|reportCampaign\)" vibes.diy/pkg/app`. Build the worklist.

- [ ] **Step 2..N: Per route**, swap and commit. Known sites from the spec:
  - `routes/settings.tsx` (`listHandleBindings`, `createHandleBinding`, `deleteHandleBinding`, `ensureUserSettings`)
  - `routes/settings/csr-to-cert.tsx` (`getCertFromCsr`)
  - `routes/messages.tsx`, `routes/messages.$ownerHandleA.$ownerHandleB.tsx` (`listHandleBindings`, `listDmThreads`)
  - `hooks/useChatOwnership.ts`, `components/ResultPreview/DataView.tsx` (`listHandleBindings`)
  - recent-vibes / memberships / models hooks (`useRecentVibes`, `useMemberships`, `listModels` callers)
  - the reporting dashboard (`report*`)
  - `whoAmI`: migrate ONLY the plain (no `adminMode`) reads; the admin path is already pinned to `vibeApi` in Phase 1 — do not touch it.

  For each: `git commit -m "refactor: route <screen> shared reads to sharedApi"`.

- [ ] **Step 3: Run the full suite.** Run: `pnpm check`. Expected: PASS.

### Task 4.3: Connection-matrix test

**Files:**

- Create: `vibes.diy/tests/app/connection-matrix.test.tsx` (or extend an existing provider test — `grep -rl "LiveCycleVibesDiyProvider\|vibesDiyApis" vibes.diy/tests`)

- [ ] **Step 1: Write tests** asserting the eager socket targets per route × auth using the provider's construction logic. Assert the URLs handed to `vibesDiyApis.get(...)`:
  - vibe route, any auth → a `/api/app?vibe=…` URL; `sharedApi === vibeApi`; no `/api/shared`.
  - non-vibe authed → one `/api/shared?shard=<userNotifyShardFor(id)>`; no `/api`/`/api/app`.
  - non-vibe anon → one `/api/shared?shard=global`.

Mock `useLocation`/`useClerk` as neighbouring provider tests do (find the pattern first). If the provider is hard to unit-test, assert the seam instead: `sharedReadShardFor` (done) + a small exported `sharedApiUrlFor(apiUrl, shard)` helper you factor out of `buildSharedApi`.

- [ ] **Step 2: Run, iterate to green.** Run: `cd vibes.diy/tests && pnpm vitest run connection-matrix`. Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add vibes.diy/tests/app/connection-matrix.test.tsx
git commit -m "test: assert one eager socket target per route x auth"
```

---

## Phase 5 — True lazy `chatApi` + rollout gate

Make the provider stop opening `chatApi` eagerly; build it on the first remaining chat-handler call (`openChat`/`promptChatSection`/app-create) and for `srvVibeSandbox`.

### Task 5.1: Failing test — no eager ChatSessions on a non-chat page

**Files:**

- Create/extend: `vibes.diy/tests/app/lazy-chat.test.tsx`

- [ ] **Step 1: Write the failing test.** Render the provider on a non-chat, non-vibe route (e.g. `/settings`) and assert no `/api` (ChatSessions) WebSocket URL was constructed — only `/api/shared`. Then simulate a chat action and assert the `/api` socket is constructed exactly once.

```ts
it("non-chat page opens no chat socket; first chat action cold-opens it", async () => {
  const { ctorUrls, fireChatAction } = renderProviderAt("/settings"); // adapt harness
  expect(ctorUrls.some((u) => u.includes("/api/shared"))).toBe(true);
  expect(ctorUrls.some((u) => /\/api(\?|$)/.test(u))).toBe(false);
  await fireChatAction();
  expect(ctorUrls.filter((u) => /\/api(\?|$)/.test(u)).length).toBe(1);
});
```

- [ ] **Step 2: Run, expect FAIL** (chatApi is constructed eagerly today). Expected: FAIL (chat socket present at render).

- [ ] **Step 3: Commit the failing test.**

```bash
git add vibes.diy/tests/app/lazy-chat.test.tsx
git commit -m "test: chatApi must be lazy on non-chat pages"
```

### Task 5.2: Lazy `chatApi` construction seam

**Files:**

- Modify: `vibes.diy/pkg/app/vibes-diy-provider.tsx:168-245` (the eager `realCtx.chatApi = …` block), `VibesDiyCtx` (`:49`), `srv-sandbox` wiring (`:316`).

- [ ] **Step 1: Convert `chatApi` to a memoised lazy getter.** Keep the existing `.once()` factory body, but defer invoking it. Two viable shapes — pick the one that fits the codebase's `VibesDiyApiIface` consumers (read them first):
  - (a) Expose `chatApi` as a getter on `realCtx` that builds-on-first-access via the same `vibesDiyApis.get(apiUrl).once(factory)` cache (so repeated access returns the same instance), or
  - (b) Add `realCtx.ensureChatApi(): VibesDiyApiIface` and have call sites (openChat/prompt/app-create, `srvVibeSandbox`) call it; keep `chatApi` undefined until then.

Prefer (a) if `VibesDiyApiIface` is always accessed via `realCtx.chatApi` (smallest call-site churn); the getter just must not run the factory until first read.

```ts
// sketch for (a): replace `realCtx.chatApi = vibesDiyApis.get(apiUrl).once(factory)`
let chatApiInstance: VibesDiyApiIface | undefined;
const chatApiFactory = () => {
  /* existing :168-245 body, returns new VibesDiyApi */
};
Object.defineProperty(realCtx, "chatApi", {
  configurable: true,
  get() {
    if (!chatApiInstance) chatApiInstance = vibesDiyApis.get(apiUrl).once(chatApiFactory) as VibesDiyApiIface;
    return chatApiInstance;
  },
});
```

Note: the Clerk listener + `realCtx.getToken`/`sharedGetToken` assignment currently happen **inside** the chatApi factory. Those must still run eagerly (sharedApi/vibeApi depend on `sharedGetToken`). **Hoist** the `getToken` definition + `clerk.addListener(...)` + `realCtx.getToken = getToken; sharedGetToken = getToken;` out of the factory to run unconditionally; the factory then only constructs the `VibesDiyApi`.

- [ ] **Step 2: Make `srvVibeSandbox` take chat lazily.** It is built with `chatApi: realCtx.chatApi` (`:316`). If the sandbox only needs chat for chat actions, pass a getter (`getChatApi: () => realCtx.chatApi`) or the lazy `realCtx` reference. Read `VibesDiySrvSandbox`'s signature; adapt minimally so constructing the sandbox does not read `realCtx.chatApi` (which would defeat laziness). If the sandbox stores the value eagerly, add a `setChatApi`/getter path mirroring `setVibeApi` (`:343`).

- [ ] **Step 3: Audit eager readers.** Run: `grep -rn "\.chatApi" vibes.diy/pkg/app`. Any module that reads `chatApi` at render/mount (not inside a user action) would force a cold-open — confirm each remaining reader is a genuine chat action or repoint it to `sharedApi`/`vibeApi`. Title-sensitive paths (`ensure-chat-id`, app-metadata generation, `openChat` refresh) are genuine chat actions — leaving them to trigger the lazy open is correct.

- [ ] **Step 4: Run the lazy-chat test + full suite.** Run: `cd vibes.diy/tests && pnpm vitest run lazy-chat` then `pnpm check`. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add vibes.diy/pkg/app/vibes-diy-provider.tsx
git commit -m "feat: construct chatApi lazily on first chat action"
```

### Task 5.3: Sandbox-specific lazy-chat regression (`srvVibeSandbox`)

The `srvVibeSandbox` is the most likely path to silently re-introduce an eager `chatApi` (it is constructed on every render at `:301`, today with `chatApi: realCtx.chatApi`). Lock it with its own test so a future change to the sandbox wiring can't regress the invariant. (Suggested by `@CharlieHelps`.)

**Files:**

- Create/extend: `vibes.diy/tests/app/lazy-chat-sandbox.test.tsx`

- [ ] **Step 1: Write the failing-then-green test.** Render the provider on a non-chat, non-vibe route so `srvVibeSandbox` is constructed, and assert that constructing the sandbox does **not** force a ChatSessions socket open — i.e. no `/api` (chat) URL is handed to `vibesDiyApis.get(...)` until a sandbox-driven chat action fires.

```ts
it("constructing srvVibeSandbox on a non-chat page opens no chat socket", async () => {
  const { ctorUrls, sandbox } = renderProviderAt("/settings"); // same harness as lazy-chat.test
  expect(sandbox).toBeDefined();
  expect(ctorUrls.some((u) => /\/api(\?|$)/.test(u))).toBe(false); // no ChatSessions socket
  // and a sandbox path that needs chat cold-opens exactly one:
  await sandbox.someChatDrivenAction?.(); // pick a real sandbox chat entrypoint
  expect(ctorUrls.filter((u) => /\/api(\?|$)/.test(u)).length).toBeLessThanOrEqual(1);
});
```

Confirm the sandbox's chat entrypoint name from `VibesDiySrvSandbox` (the one that previously used the eager `chatApi`); if the sandbox needs no chat at all on these routes, the second assertion becomes `=== 0`.

- [ ] **Step 2: Run, iterate to green** (this passes once Task 5.2 Step 2 makes the sandbox take chat lazily). Run: `cd vibes.diy/tests && pnpm vitest run lazy-chat-sandbox`. Expected: PASS.

- [ ] **Step 3: Commit.**

```bash
git add vibes.diy/tests/app/lazy-chat-sandbox.test.tsx
git commit -m "test: srvVibeSandbox opens no eager ChatSessions on non-chat pages"
```

### Task 5.4: Verify the eager-connection invariant end to end

- [ ] **Step 1: Run the connection-matrix + lazy-chat + sandbox + notification tests together.** Run: `pnpm check`. Expected: PASS, with the matrix proving exactly one eager socket per route × auth and zero ChatSessions on non-chat pages.

- [ ] **Step 2: Update the living architecture doc.** Append a short note to `agents/do-session-split.md` recording that Track B shipped: SharedSessions DO, lazy chatApi, chat-only ChatSessions, admin whoAmI on vibeApi. Commit.

```bash
git add agents/do-session-split.md
git commit -m "docs: record Track B (SharedSessions) in do-session-split"
```

---

## Phase 6 — Runtime verification gate (real routes, network-level)

Unit tests assert which URLs the provider _constructs_; this phase proves the eager-connection matrix on a **real deployed preview** at the network layer — the only place that catches a socket opened by something outside the provider's construction path (an effect, a third-party hook, a redirect). Run after Phase 4/5 land and the PR has a preview URL. (Suggested by `@CharlieHelps`.)

**Tooling:** the `chrome-devtools` MCP (network inspection) — or the `qa-pr` skill, which already drives it. Drive an actual browser against the preview; do not infer from source.

### Task 6.1: Prove the matrix per route on the preview

- [ ] **Step 1: Capture WebSocket opens per route.** For each cell, load the route on the preview, list network requests, and filter to WebSocket upgrades whose URL path is `/api`, `/api/app`, or `/api/shared`. Use `list_network_requests` (or `qa-pr`).

- [ ] **Step 2: Assert exactly one eager socket per route × auth:**

| Route                         | Auth       | Expected eager WS                                | Must be ABSENT                       |
| ----------------------------- | ---------- | ------------------------------------------------ | ------------------------------------ |
| `/settings` (non-vibe)        | signed-in  | one `/api/shared?shard=<userNotifyShardFor(id)>` | any `/api` (chat), any `/api/app`    |
| `/` or `/settings` (non-vibe) | signed-out | one `/api/shared?shard=global`                   | any `/api` (chat)                    |
| `/vibe/<owner>/<slug>`        | any        | one `/api/app?vibe=…`                            | any `/api` (chat), any `/api/shared` |

- [ ] **Step 3: Prove lazy chat cold-opens on demand.** On `/settings` signed-in, confirm zero `/api` (chat) sockets at rest, then trigger a chat action (navigate into a chat / start a prompt) and confirm exactly one `/api` chat socket opens.

- [ ] **Step 4: Prove notifications still deliver.** With only the `/api/shared` socket open on a non-vibe page, trigger a build-completion notification for the signed-in user (or replay one) and confirm the client receives it over the shared-plane socket — verifying the `shared:` fan-out prefix resolves end to end.

- [ ] **Step 5: Record the result on the PR.** Post a short pass/fail summary (with the per-route socket list) as a PR comment. If any cell fails, capture the offending opener (initiator stack) and open a follow-up before claiming the matrix holds.

---

## Self-review checklist (run before handing off)

- **Spec coverage:** singleton/per-user sharding (4.1 + seam), `global` anon fallback (4.1), notify rides shared-plane (4.1 step 6), UserNotify fan-out unchanged + `shared:` prefix (3.2, 3.5), chat-only + re-home (Phase 2), lazy chat (Phase 5, incl. sandbox regression 5.3), runtime network-level matrix gate (Phase 6), no SSR path (nothing added — confirm `app.ts` SSR untouched), whoAmI admin-mode (Phase 1), wrangler/rollout (3.7). ✅
- **Placeholder scan:** every code step shows real code; test bodies are concrete; harness-dependent steps explicitly say "adapt from <named existing test>" rather than inventing an unknown API.
- **Type consistency:** `sharedApi: VibesDiyApiIface` (4.1) used consistently; `sharedReadShardFor(userId)` signature matches its test; `SHARED_SESSIONS` name identical across cf-env, resolve-shard-do, route dispatch, wrangler; evento accessor `sharedMsgEvento()` matches `chatMsgEvento()` usage.
- **Open risk to flag at execution:** the `skipShard` ↔ URL-`shard` interaction (4.1 step 4) and the `cfServeAppCtx` required-callback set for a no-broadcast/no-access-fn DO (3.5 step 2) are the two spots most likely to need a small adjustment against the real types — both are called out inline.
