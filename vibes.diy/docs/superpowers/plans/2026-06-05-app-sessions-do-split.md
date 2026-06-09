# AppSessions DO Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new AppSessions Durable Object that handles all vibe-scoped operations (putDoc, subscribeDocs, grants, access control) with zero DO-to-DO subrequests — local QuickJS evaluation and local broadcast replace AccessFnDO and DocNotify.

**Architecture:** AppSessions is sharded by `(ownerHandle/appSlug)` so all connections to the same vibe share one DO instance. Notifications are local broadcasts (iterate connections, match subscriptions). Access function evaluation is inlined (cached QuickJS WASM module, fresh context per eval). ChatSessions stays untouched — it handles chat streaming (openChat, promptChatSection). The client creates two VibesDiyApi instances and routes messages by type.

**Tech Stack:** Cloudflare Workers/Durable Objects, TypeScript, QuickJS WASM (`@cf-wasm/quickjs`), Evento message dispatch, Drizzle ORM (D1/libSQL)

**Spec:** `docs/superpowers/specs/2026-06-05-app-sessions-do-split-design.md`

---

## File structure

| File | Responsibility |
|------|---------------|
| `pkg/workers/route-decision.ts` | Modify: add `"app-api"` route type for `/api/app` |
| `api/types/cf-env.ts` | Modify: add `APP_SESSIONS: DurableObjectNamespace` |
| `pkg/wrangler.toml` | Modify: add APP_SESSIONS binding + v5 migration (all envs) |
| `api/svc/app-msg-evento.ts` | Create: Evento instance with vibe-scoped + shared handlers only |
| `api/svc/cf-serve.ts` | Modify: add `localBroadcastCallbacks` + `localInvokeAccessFn` factories |
| `pkg/workers/app-sessions.ts` | Create: the new DO class — WebSocket handling, local broadcast, local QuickJS |
| `pkg/workers/app.ts` | Modify: add `"app-api"` routing + export AppSessions |
| `pkg/app/vibes-diy-provider.tsx` | Modify: create second VibesDiyApi for `/api/app?vibe=...` |

---

### Task 1: Route decision — add "app-api" route type

**Files:**
- Modify: `pkg/workers/route-decision.ts`
- Test: `api/tests/route-decision.test.ts`

- [ ] **Step 1: Write the failing test**

Add test cases for the new `app-api` route in `api/tests/route-decision.test.ts`:

```typescript
it("/api/app → app-api (AppSessions DO)", () => {
  expect(decide({ pathname: "/api/app" })).toBe("app-api");
  expect(decide({ pathname: "/api/app", method: "GET" })).toBe("app-api");
});

it("/api/app?vibe=alice--myapp → app-api (vibe-keyed WebSocket)", () => {
  expect(decide({ pathname: "/api/app" })).toBe("app-api");
});

it("regression: /api/app must not fall through to api-do", () => {
  expect(decide({ pathname: "/api/app" })).not.toBe("api-do");
});

it("regression: /api (without /app) still routes to api-do", () => {
  expect(decide({ pathname: "/api" })).toBe("api-do");
  expect(decide({ pathname: "/api/" })).toBe("api-do");
  expect(decide({ pathname: "/api/foo" })).toBe("api-do");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vibes.diy && pnpm vitest run api/tests/route-decision.test.ts`
Expected: FAIL — `"app-api"` is not a valid Route, tests don't compile

- [ ] **Step 3: Add "app-api" to the Route union and routing logic**

In `pkg/workers/route-decision.ts`, add `"app-api"` to the Route type and add the routing check BEFORE the existing `/api` check:

```typescript
export type Route =
  | "app-api"  // /api/app → AppSessions DO (vibe-scoped WebSocket)
  | "api-do"   // /api/* → ChatSessions DO (WebSocket + DocNotify)
  | "vibe-pkg"
  // ... rest unchanged
```

In `routeDecision()`, add the `/api/app` check before the `/api` catch-all:

```typescript
if (pathname === "/api/app" || pathname.startsWith("/api/app/")) {
  return "app-api";
}
if (pathname === "/api" || pathname.startsWith("/api/")) {
  return "api-do";
}
```

Order matters: `/api/app` must match before `/api/*` or it falls through to `api-do`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vibes.diy && pnpm vitest run api/tests/route-decision.test.ts`
Expected: PASS — all existing tests still pass, new tests pass

- [ ] **Step 5: Commit**

```bash
git add pkg/workers/route-decision.ts api/tests/route-decision.test.ts
git commit -m "feat(routing): add app-api route for /api/app → AppSessions DO"
```

---

### Task 2: CFEnv type + wrangler.toml bindings

**Files:**
- Modify: `api/types/cf-env.ts`
- Modify: `pkg/wrangler.toml`

- [ ] **Step 1: Add APP_SESSIONS to CFEnv interface**

In `api/types/cf-env.ts`, add the new binding alongside the existing DO bindings:

```typescript
CHAT_SESSIONS: DurableObjectNamespace;
APP_SESSIONS: DurableObjectNamespace;
DOC_NOTIFY: DurableObjectNamespace;
```

- [ ] **Step 2: Add APP_SESSIONS binding to wrangler.toml top-level**

In `pkg/wrangler.toml`, add APP_SESSIONS to the main `[durable_objects]` bindings:

```toml
[durable_objects]
bindings = [
  { name = "CHAT_SESSIONS", class_name = "ChatSessions" },
  { name = "APP_SESSIONS", class_name = "AppSessions" },
  { name = "DOC_NOTIFY", class_name = "DocNotify" },
  { name = "USER_NOTIFY", class_name = "UserNotify" },
  { name = "ACCESS_FN_DO", class_name = "AccessFnDO" },
]
```

Add the v5 migration after the existing v4:

```toml
[[migrations]]
tag = "v5"
new_classes = ["AppSessions"]
```

- [ ] **Step 3: Add APP_SESSIONS to every env block**

Repeat for `env.local`, `env.dev`, `env.preview`, `env.prod` — add `{ name = "APP_SESSIONS", class_name = "AppSessions" }` to each env's `durable_objects.bindings` array, and add a v5 migration to each env's migrations.

For `env.cli`, cross-script-bind APP_SESSIONS to prod (same pattern as DocNotify/UserNotify — CLI operations should reach the same DO instances as prod so local broadcast reaches prod-side viewers):

```toml
[env.cli.durable_objects]
bindings = [
  { name = "CHAT_SESSIONS", class_name = "ChatSessions" },
  { name = "APP_SESSIONS", class_name = "AppSessions", script_name = "vibes-diy-v2-prod" },
  { name = "DOC_NOTIFY", class_name = "DocNotify", script_name = "vibes-diy-v2-prod" },
  { name = "USER_NOTIFY", class_name = "UserNotify", script_name = "vibes-diy-v2-prod" },
  { name = "ACCESS_FN_DO", class_name = "AccessFnDO" },
]
```

- [ ] **Step 4: Run the wrangler migrations test**

Run: `cd vibes.diy && pnpm vitest run --config pkg/test/vitest.config.ts pkg/test/wrangler-migrations.test.ts`
Expected: PASS — sequential v1..v5 tags with no gaps in every env block

- [ ] **Step 5: Run pnpm check to verify types compile**

Run: `cd vibes.diy && pnpm check`
Expected: PASS (or type errors in files that reference APP_SESSIONS but don't have it yet — those are addressed in later tasks)

- [ ] **Step 6: Commit**

```bash
git add api/types/cf-env.ts pkg/wrangler.toml
git commit -m "feat(infra): add APP_SESSIONS DO binding + v5 migration to all envs"
```

---

### Task 3: AppSessions Evento — vibe-scoped handler set

**Files:**
- Create: `api/svc/app-msg-evento.ts`

The AppSessions DO needs its own Evento instance that includes only vibe-scoped handlers + shared stateless handlers. ChatSessions' `vibesMsgEvento` stays unchanged.

**Handler split rationale** (from the spec's message type table):

- **AppSessions only:** putDoc, getDoc, queryDocs, deleteDoc, subscribeDocs, subscribeViewerGrants, listDbNames, listDmThreads, markDmRead, whoAmI, listMembers, listMemberships, assetUploadGrant, requestAccess, approveRequest, requestSetRole, revokeRequest, hasAccessRequest, listRequestGrants, subscribeRequestGrants, createInvite, revokeInvite, redeemInvite, hasAccessInvite, inviteSetRole, listInviteGrants, subscribeUserNotifications
- **Both DOs** (stateless D1 queries): ensureAppSettings, ensureUserSettings, listUserSlugAppSlug, listRecentVibes, pinRecentVibe, getAppByFsId, listModels
- **ChatSessions only** (not in AppSessions): openChat, promptChatSection, getChatDetails, listApplicationChats, forkApp, ensureAppSlugItem, setModeFsId, getCertFromCsr, listHandleBindings, createHandleBinding, deleteHandleBinding, all report endpoints

- [ ] **Step 1: Create api/svc/app-msg-evento.ts**

```typescript
import { Lazy, Evento, EventoResult, EventoType, Result } from "@adviser/cement";
import { W3CWebSocketEventEventoEnDecoder } from "@vibes.diy/api-pkg";
import { ResError } from "@vibes.diy/api-types";

// Data operations (vibe-scoped)
import {
  putDocEvento,
  getDocEvento,
  queryDocsEvento,
  deleteDocEvento,
  subscribeDocsEvento,
  subscribeViewerGrantsEvento,
  listDbNamesEvento,
  listDmThreadsEvento,
  markDmReadEvento,
} from "./public/app-documents.js";

// Access control (vibe-scoped)
import {
  createInviteEvento,
  revokeInviteEvento,
  redeemInviteEvento,
  hasAccessInviteEvento,
  inviteSetRoleEvento,
  listInviteGrantsEvento,
} from "./public/invite-flow.js";
import {
  listRequestGrantsEvento,
  subscribeRequestGrantsEvento,
  requestAccessEvento,
  approveRequestEvento,
  requestSetRoleEvento,
  revokeRequestEvento,
  hasAccessRequestEvento,
} from "./public/request-flow.js";

// Membership (vibe-scoped)
import { listMembersEvento } from "./public/list-members.js";
import { listMembershipsEvento } from "./public/list-memberships.js";
import { whoAmIEvento } from "./public/who-am-i.js";

// Assets
import { assetUploadGrantEvento } from "./public/asset-upload-grant.js";

// User notifications
import { subscribeUserNotificationsEvento } from "./public/subscribe-user-notifications.js";

// Shared stateless handlers (registered on both DOs)
import { ensureAppSettingsEvento } from "./public/ensure-app-settings.js";
import { ensureUserSettingsEvento } from "./public/ensure-user-settings.js";
import { listUserSlugAppSlugEvento } from "./public/list-user-slug-app-slug.js";
import { listRecentVibesEvento } from "./public/list-recent-vibes.js";
import { pinRecentVibeEvento } from "./public/pin-recent-vibe.js";
import { getAppByFsIdEvento } from "./public/get-app-by-fsid.js";
import { listModelsEvento } from "./public/list-models.js";

export const appMsgEvento = Lazy(() => {
  const evento = new Evento(new W3CWebSocketEventEventoEnDecoder());
  evento.push(
    // Data operations
    putDocEvento,
    getDocEvento,
    queryDocsEvento,
    deleteDocEvento,
    subscribeDocsEvento,
    subscribeViewerGrantsEvento,
    listDbNamesEvento,
    listDmThreadsEvento,
    markDmReadEvento,

    // Access control — invites
    createInviteEvento,
    revokeInviteEvento,
    redeemInviteEvento,
    hasAccessInviteEvento,
    inviteSetRoleEvento,
    listInviteGrantsEvento,

    // Access control — requests
    requestAccessEvento,
    hasAccessRequestEvento,
    approveRequestEvento,
    requestSetRoleEvento,
    revokeRequestEvento,
    listRequestGrantsEvento,
    subscribeRequestGrantsEvento,

    // Membership
    listMembersEvento,
    listMembershipsEvento,
    whoAmIEvento,

    // Assets
    assetUploadGrantEvento,

    // User notifications
    subscribeUserNotificationsEvento,

    // Shared stateless handlers
    ensureAppSettingsEvento,
    ensureUserSettingsEvento,
    listUserSlugAppSlugEvento,
    listRecentVibesEvento,
    pinRecentVibeEvento,
    getAppByFsIdEvento,
    listModelsEvento,

    // Wildcard: misrouted messages get "Not Implemented"
    {
      type: EventoType.WildCard,
      hash: "app-not-msg-implemented-handler",
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
      hash: "app-error-handler",
      handle: async (ctx) => {
        console.error("appMsgEvento error-handler", ctx.error, (ctx.error as { cause?: unknown })?.cause);
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

- [ ] **Step 2: Verify it compiles**

Run: `cd vibes.diy && pnpm check`
Expected: PASS — all imports resolve, types are correct

- [ ] **Step 3: Commit**

```bash
git add api/svc/app-msg-evento.ts
git commit -m "feat(evento): add appMsgEvento with vibe-scoped + shared handler subset"
```

---

### Task 4: cf-serve.ts — local broadcast + local access fn callback factories

**Files:**
- Modify: `api/svc/cf-serve.ts`

Add two new factory functions that provide the same callback interface as `docNotifyCallbacks` and `invokeAccessFn` but operate locally — no DO-to-DO subrequests. These are used by AppSessions; ChatSessions continues using the existing DocNotify-based callbacks unchanged.

- [ ] **Step 1: Add localBroadcastCallbacks factory**

Add this function in `api/svc/cf-serve.ts` after the existing `userNotifyCallbacks` function (after line 233). It takes the DO's connections set and provides the same callback interface as `docNotifyCallbacks`, but iterates local connections instead of calling DocNotify:

```typescript
export function localBroadcastCallbacks(connections: Set<WSSendProvider>, env: CFEnv) {
  const shouldLog = env.ENVIRONMENT !== "prod";

  return {
    notifyDocChanged: async (
      evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string },
      senderConnId: string
    ) => {
      const key = `${evt.ownerHandle}/${evt.appSlug}/${evt.dbName}`;
      const fullEvt = { type: "vibes.diy.evt-doc-changed" as const, ...evt };
      let delivered = 0;
      for (const conn of connections) {
        if (!conn.subscribedDocKeys.has(key)) continue;
        if (conn.connId === senderConnId) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({
              tid: crypto.randomUUID(),
              src: "vibes.diy.api",
              dst: "vibes.diy.client",
              ttl: 10,
              payload: fullEvt,
            })
          )
        );
        delivered++;
      }
      if (shouldLog) {
        console.log("[AppSessions] local broadcast doc-changed", key, "delivered:", delivered, "of", connections.size);
      }
    },
    registerDocSubscription: async (_subscriptionKey: string) => {
      // No-op: all connections are on this DO, no external coordinator needed
    },
    deregisterDocSubscription: async (_subscriptionKey: string) => {
      // No-op
    },
    notifyRequestGrantChanged: async (evt: EvtRequestGrant, senderConnId: string) => {
      const key = `${evt.grant.ownerHandle}/${evt.grant.appSlug}`;
      let delivered = 0;
      for (const conn of connections) {
        if (!conn.subscribedRequestGrantKeys.has(key)) continue;
        if (conn.connId === senderConnId) continue;
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
      if (shouldLog) {
        console.log("[AppSessions] local broadcast request-grant", key, "delivered:", delivered);
      }
    },
    notifyViewerGrantsChanged: async (evt: EvtViewerGrantsChanged, senderConnId: string) => {
      const key = `${evt.ownerHandle}/${evt.appSlug}`;
      let delivered = 0;
      for (const conn of connections) {
        if (!conn.subscribedViewerGrantKeys.has(key)) continue;
        // Deliver to sender for viewer-grants-changed (iframe needs grant refresh)
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
      if (shouldLog) {
        console.log("[AppSessions] local broadcast viewer-grants-changed", key, "delivered:", delivered);
      }
    },
    registerRequestGrantSubscription: async (_subscriptionKey: string) => {},
    deregisterRequestGrantSubscription: async (_subscriptionKey: string) => {},
    registerViewerGrantsSubscription: async (_subscriptionKey: string) => {},
    deregisterViewerGrantsSubscription: async (_subscriptionKey: string) => {},
  };
}
```

- [ ] **Step 2: Add localInvokeAccessFn factory**

Add this function in `api/svc/cf-serve.ts`. It evaluates access functions locally using QuickJS instead of calling AccessFnDO via subrequest. The WASM module is lazily loaded and cached by the caller (AppSessions DO instance):

```typescript
import { getQuickJSWASMModule, type QuickJSWASMModule } from "@cf-wasm/quickjs";

export async function localInvokeAccessFn(
  cachedModuleRef: { module: QuickJSWASMModule | null },
  params: {
    cid: string;
    doc: unknown;
    oldDoc: unknown | null;
    user: UserContext | null;
    source?: string;
    grantState?: {
      members: Record<string, string[]>;
      roleGrants: Record<string, string[]>;
      userGrants: Record<string, string[]>;
    };
    adminMode?: boolean;
  }
): Promise<AccessDescriptor | { forbidden: string }> {
  if (!params.source) {
    return { forbidden: "access function source not provided" };
  }

  const source = params.source;
  const grantState = params.grantState ?? { members: {}, roleGrants: {}, userGrants: {} };

  function resolveChannels(userHandle: string): Set<string> {
    const channels = new Set<string>();
    const direct = grantState.userGrants[userHandle];
    if (direct) for (const ch of direct) channels.add(ch);
    for (const [role, members] of Object.entries(grantState.members)) {
      if ((members as string[]).includes(userHandle)) {
        const roleChannels = grantState.roleGrants[role];
        if (roleChannels) for (const ch of roleChannels) channels.add(ch);
      }
    }
    return channels;
  }

  if (!cachedModuleRef.module) {
    cachedModuleRef.module = await getQuickJSWASMModule();
  }
  const vm = cachedModuleRef.module.newContext();

  try {
    for (const stmt of [
      `const doc = ${JSON.stringify(params.doc)};`,
      `const oldDoc = ${JSON.stringify(params.oldDoc)};`,
      `const user = ${JSON.stringify(params.user)};`,
    ]) {
      const r = vm.evalCode(stmt);
      if (r.error) {
        const errVal = vm.dump(r.error);
        r.error.dispose();
        return { forbidden: `access function setup error: ${String(errVal)}` };
      } else {
        r.value.dispose();
      }
    }

    const ctxObj = vm.newObject();

    const requireAccessFn = vm.newFunction("requireAccess", (channelIdHandle) => {
      if (params.adminMode === true) return undefined;
      const channelId = vm.dump(channelIdHandle) as string;
      if (!params.user) return { error: vm.newError("authentication required") };
      const channels = resolveChannels(params.user.userHandle);
      if (!channels.has(channelId)) return { error: vm.newError(`not in channel: ${channelId}`) };
      return undefined;
    });

    const requireRoleFn = vm.newFunction("requireRole", (roleNameHandle) => {
      if (params.adminMode === true) return undefined;
      const roleName = vm.dump(roleNameHandle) as string;
      if (!params.user) return { error: vm.newError("authentication required") };
      const roleMembers = grantState.members[roleName] as string[] | undefined;
      if (!roleMembers?.includes(params.user.userHandle)) return { error: vm.newError(`not in role: ${roleName}`) };
      return undefined;
    });

    vm.setProp(ctxObj, "requireAccess", requireAccessFn);
    vm.setProp(ctxObj, "requireRole", requireRoleFn);
    vm.setProp(vm.global, "ctx", ctxObj);
    requireAccessFn.dispose();
    requireRoleFn.dispose();
    ctxObj.dispose();

    const cleanSource = source.replace(/export\s+/g, "").replace(/^default\s+/, "");
    const fnNameMatch = cleanSource.match(/^function\s+(\w+)\s*\(/);
    const isAnonymousFnOrArrow =
      /^function\s*\(/.test(cleanSource) || /^\(/.test(cleanSource) || /^\w+\s*=>/.test(cleanSource);
    const evalSource = fnNameMatch
      ? `${cleanSource}\n;${fnNameMatch[1]}(doc, oldDoc, user, ctx)`
      : isAnonymousFnOrArrow
        ? `const __accessFn = ${cleanSource}\n;__accessFn(doc, oldDoc, user, ctx)`
        : `(function() { ${cleanSource} })()`;
    const fnResult = vm.evalCode(evalSource);

    if (fnResult.error) {
      const errVal = vm.dump(fnResult.error);
      fnResult.error.dispose();
      const reason =
        typeof errVal === "object" && errVal !== null && "forbidden" in errVal
          ? String((errVal as Record<string, unknown>).forbidden)
          : typeof errVal === "string"
            ? errVal
            : `access function error: ${JSON.stringify(errVal)}`;
      return { forbidden: reason };
    }

    const accessResult = vm.dump(fnResult.value);
    fnResult.value.dispose();
    return accessResult as AccessDescriptor;
  } finally {
    vm.dispose();
  }
}
```

- [ ] **Step 3: Export the new functions**

Verify both `localBroadcastCallbacks` and `localInvokeAccessFn` are exported from `api/svc/cf-serve.ts`. Also add the `getQuickJSWASMModule` import and `QuickJSWASMModule` type import at the top of the file.

- [ ] **Step 4: Run pnpm check to verify compilation**

Run: `cd vibes.diy && pnpm check`
Expected: PASS — new functions compile, existing code unaffected

- [ ] **Step 5: Commit**

```bash
git add api/svc/cf-serve.ts
git commit -m "feat(cf-serve): add localBroadcastCallbacks + localInvokeAccessFn for AppSessions"
```

---

### Task 5: AppSessions DO class

Depends on: Task 2 (CFEnv type), Task 3 (appMsgEvento), Task 4 (local callbacks)

**Files:**
- Create: `pkg/workers/app-sessions.ts`

This is the core new DO. It handles WebSocket connections for vibe-scoped operations with zero DO-to-DO subrequests for putDoc. Notifications use local broadcast; access function evaluation uses local QuickJS.

- [ ] **Step 1: Create pkg/workers/app-sessions.ts**

```typescript
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
import { CFInjectMutable, cfServeAppCtx, localBroadcastCallbacks, localInvokeAccessFn } from "@vibes.diy/api-svc/cf-serve.js";
import { CFEnv } from "@vibes.diy/api-types";
import { exception2Result, URI } from "@adviser/cement";
import { type } from "arktype";
import { appMsgEvento } from "@vibes.diy/api-svc/app-msg-evento.js";
import type { QuickJSWASMModule } from "@cf-wasm/quickjs";

const UserNotifyEvtShape = type({
  type: "'vibes.diy.evt-user-notification'",
  notificationType: "string",
  ownerHandle: "string",
  appSlug: "string",
});

const UserNotifyDelivery = type({
  evt: UserNotifyEvtShape,
  senderConnId: "string",
  targetUserId: "string",
});

declare const caches: CacheStorage;
declare const Response: typeof CFResponse;
declare const WebSocketPair: typeof WebSocketPairType;

function cfWebSocketPair(): { client: WebSocket; server: WebSocket } {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];
  return { client: client as unknown as WebSocket, server: server as unknown as WebSocket };
}

export class AppSessions implements DurableObject {
  private connections: Set<WSSendProvider> = new Set<WSSendProvider>();
  private env: CFEnv;
  private vibeKey: string | undefined;

  // Memoized caches — populated lazily, reused across messages
  private quickjsModule: { module: QuickJSWASMModule | null } = { module: null };

  constructor(_state: DurableObjectState, env: CFEnv) {
    this.env = env;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    // UserNotify fan-out delivery — same pattern as ChatSessions
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
          if (conn.connId === senderConnId) continue;
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
          "[AppSessions] user-notify",
          evt.notificationType,
          evt.ownerHandle + "/" + evt.appSlug,
          "| delivered to",
          delivered,
          "connections"
        );
        return new Response("ok");
      }

      return new Response("unknown POST", { status: 400 });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // Extract vibe key from URL for logging/identity
    const uri = URI.from(request.url);
    this.vibeKey = uri.getParam("vibe") ?? this.vibeKey;

    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    cctx.cache = caches.default as unknown as CfCacheIf;
    cctx.webSocket = {
      connections: this.connections,
      webSocketPair: cfWebSocketPair,
    };

    // Use local broadcast instead of DocNotify subrequests.
    // The docNotify field stays undefined — cfServeAppCtx will NOT
    // spread docNotifyCallbacks. Instead we provide the local overrides
    // directly.
    cctx.docNotify = undefined;

    // Build appCtx with local broadcast + local access fn evaluation
    const broadcastCbs = localBroadcastCallbacks(this.connections, this.env);
    const quickjsRef = this.quickjsModule;

    cctx.appCtx = (
      await cfServeAppCtx(request, this.env, cctx, {
        ...broadcastCbs,
        ...userNotifyCallbacksForAppSessions(this.vibeKey, this.env),
        invokeAccessFn: (params) => localInvokeAccessFn(quickjsRef, params),
      })
    ).appCtx;

    return cfServe(request, cctx, appMsgEvento);
  }
}

function userNotifyCallbacksForAppSessions(vibeKey: string | undefined, env: CFEnv) {
  function fetchUserNotify(userId: string, body: Record<string, unknown>): Promise<CFResponse> {
    const id = env.USER_NOTIFY.idFromName(userId);
    const stub = env.USER_NOTIFY.get(id);
    return stub.fetch(
      new Request("https://internal/user-notify", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFRequest
    );
  }

  const shardId = vibeKey ?? "app-unknown";

  return {
    notifyUser: async (userId: string, evt: unknown, senderConnId: string): Promise<void> => {
      await fetchUserNotify(userId, {
        action: "notify",
        targetUserId: userId,
        senderShardId: shardId,
        senderConnId,
        evt,
      });
    },
    registerUserSubscription: async (userId: string): Promise<void> => {
      await fetchUserNotify(userId, { action: "register", shardId });
    },
    deregisterUserSubscription: async (userId: string): Promise<void> => {
      await fetchUserNotify(userId, { action: "deregister", shardId });
    },
  };
}
```

**Important design notes for the implementer:**

1. **cfServeAppCtx needs a new overloaded signature** that accepts notification callback overrides as an optional 4th parameter. The overrides are spread into `createAppContext()` instead of (or in addition to) the docNotify-derived callbacks. The existing 3-parameter signature stays unchanged for ChatSessions. Read `api/svc/cf-serve.ts:235-347` and add the optional parameter:

```typescript
export async function cfServeAppCtx(
  request: CFRequest,
  env: CFEnv,
  ctx: ExecutionContext & Omit<CFInject, "appCtx">,
  callbackOverrides?: Record<string, unknown>
)
```

Then in the `createAppContext` call, spread overrides after (or instead of) the docNotify callbacks:

```typescript
...(ctx.docNotify ? docNotifyCallbacks(ctx.docNotify) : {}),
...(ctx.docNotify ? userNotifyCallbacks(ctx.docNotify) : {}),
...(callbackOverrides ?? {}),
```

2. **cfServe needs to accept a custom Evento instance.** Currently it hardcodes `vibesMsgEvento()`. Add an optional parameter:

```typescript
export async function cfServe(
  request: CFRequest,
  ctx: CFInject,
  eventoFactory?: () => ReturnType<typeof vibesMsgEvento>
): Promise<CFResponse> {
  // ...
  const wsEvento = eventoFactory ? eventoFactory() : vibesMsgEvento();
  // ...
}
```

3. **QuickJS WASM module** is loaded lazily on first access function evaluation, NOT in the constructor or at module load. The `cachedModuleRef` pattern ensures lazy loading: the ref starts as `{ module: null }` and `localInvokeAccessFn` populates it on first call.

4. **UserNotify integration**: AppSessions registers with UserNotify using the vibeKey as shardId. UserNotify fans out to ChatSessions only (it calls `env.CHAT_SESSIONS`). For AppSessions to receive user notifications, UserNotify would need to be updated (out of scope for this PR). User notifications continue to work via the ChatSessions connection. The POST /user-notify handler is included for forward compatibility.

- [ ] **Step 2: Run pnpm check**

Run: `cd vibes.diy && pnpm check`
Expected: PASS — AppSessions compiles with all dependencies

- [ ] **Step 3: Commit**

```bash
git add pkg/workers/app-sessions.ts api/svc/cf-serve.ts
git commit -m "feat(do): add AppSessions DO with local broadcast + local QuickJS access fn eval"
```

---

### Task 6: Worker entry integration

Depends on: Task 1 (route type), Task 2 (CFEnv), Task 5 (AppSessions class)

**Files:**
- Modify: `pkg/workers/app.ts`

- [ ] **Step 1: Export AppSessions from the worker entry**

In `pkg/workers/app.ts`, add the export alongside the existing DO exports:

```typescript
export { ChatSessions } from "./chat-sessions.js";
export { AppSessions } from "./app-sessions.js";
export { DocNotify } from "./doc-notify.js";
export { UserNotify } from "./user-notify.js";
export { AccessFnDO } from "./access-fn.js";
```

- [ ] **Step 2: Add app-api routing in the fetch handler**

In the `fetch()` handler in `pkg/workers/app.ts`, add the `app-api` case after the existing `api-do` case:

```typescript
if (route === "app-api") {
  const vibe = url.getParam("vibe");
  if (!vibe) {
    return new Response(JSON.stringify({ error: "missing ?vibe= parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }) as unknown as CFResponse;
  }
  const id = env.APP_SESSIONS.idFromName(vibe);
  const obj = env.APP_SESSIONS.get(id);
  return obj.fetch(request);
}
```

Place this BEFORE the `api-do` case (for clarity, though route-decision already distinguishes them).

- [ ] **Step 3: Run existing route-decision tests + pnpm check**

Run: `cd vibes.diy && pnpm vitest run api/tests/route-decision.test.ts && pnpm check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add pkg/workers/app.ts
git commit -m "feat(worker): route /api/app → AppSessions DO, export new DO class"
```

---

### Task 7: Client — second VibesDiyApi for AppSessions

Depends on: Task 6 (server endpoint available)

**Files:**
- Modify: `pkg/app/vibes-diy-provider.tsx`

The web app needs two WebSocket connections when viewing a vibe:
1. **Chat API** (`/api?shard=...`) — for chat operations (openChat, promptChatSection). Opens on demand.
2. **App API** (`/api/app?vibe=ownerHandle--appSlug`) — for data operations (putDoc, subscribeDocs, grants). Opens on page load.

The srv-sandbox bridge routes iframe postMessage requests to the appropriate API instance.

- [ ] **Step 1: Create appDiyApi in vibes-diy-provider.tsx**

In the `LiveCycleVibesDiyProvider` function, after the existing `realCtx.vibeDiyApi` setup (around line 224), create a second VibesDiyApi for the AppSessions connection when the user is on a vibe route:

```typescript
// App API: vibe-scoped operations (putDoc, subscribeDocs, grants, whoAmI).
// Sharded by vibe key — all connections to the same vibe land on one DO.
if (vibeMatch) {
  const ownerHandle = vibeMatch[1];
  const appSlug = vibeMatch[2];
  const appApiUrl = BuildURI.from(window.location.href)
    .protocol(window.location.protocol.startsWith("https") ? "wss" : "ws")
    .pathname("/api/app")
    .cleanParams()
    .setParam("vibe", `${ownerHandle}--${appSlug}`)
    .toString();

  realCtx.appDiyApi = vibesDiyApis.get(appApiUrl).once(() => {
    return new VibesDiyApi({
      apiUrl: appApiUrl,
      getToken,
    });
  });
} else {
  realCtx.appDiyApi = undefined;
}
```

- [ ] **Step 2: Add appDiyApi to the context type**

Add `appDiyApi` to the `realCtx` type (find its type definition and add the field):

```typescript
appDiyApi: VibesDiyApiIface | undefined;
```

- [ ] **Step 3: Pass appDiyApi to VibesDiySrvSandbox**

Update the VibesDiySrvSandbox construction to pass the appDiyApi. The VibesDiySrvSandboxArgs interface needs a new optional field:

In `vibe/srv-sandbox/srv-sandbox.ts`, add to `VibesDiySrvSandboxArgs`:

```typescript
interface VibesDiySrvSandboxArgs {
  vibeDiyApi: VibesDiyApiIface;
  appDiyApi?: VibesDiyApiIface;
  // ... rest unchanged
}
```

Then update the sandbox functions for doc operations (vibePutDoc, vibeGetDoc, vibeQueryDocs, vibeDeleteDoc, vibeSubscribeDocs, vibeListDbNames, vibeEnsureAppSettings, vibeAssetUploadGrant, vibeWhoAmI) to use `sandbox.args.appDiyApi ?? sandbox.args.vibeDiyApi` instead of `sandbox.args.vibeDiyApi`. This falls back to the chat API if no app API is available (non-vibe pages, or during transition).

Example for vibePutDoc:

```typescript
const { vibeDiyApi, appDiyApi } = sandbox.args;
const api = appDiyApi ?? vibeDiyApi;
// ... use `api` instead of `vibeDiyApi` for the putDoc call
```

- [ ] **Step 4: Pass appDiyApi from provider to sandbox**

In `vibes-diy-provider.tsx`, update the VibesDiySrvSandbox construction:

```typescript
realCtx.srvVibeSandbox = VibesDiySrvSandbox({
  vibeDiyApi: realCtx.vibeDiyApi,
  appDiyApi: realCtx.appDiyApi,
  // ... rest unchanged
});
```

- [ ] **Step 5: Wire up doc-changed listener on appDiyApi**

The `onDocChanged` listener needs to be set on the appDiyApi (since doc change events now come from AppSessions):

```typescript
if (realCtx.appDiyApi) {
  realCtx.appDiyApi.onDocChanged((ownerHandle, appSlug, dbName, docId) => {
    // same handler as existing — forward to iframe
  });
}
```

- [ ] **Step 6: Handle cleanup on navigation**

When the user navigates away from a vibe page, close the appDiyApi connection:

```typescript
// In cleanup/unmount logic:
if (realCtx.appDiyApi) {
  realCtx.appDiyApi.close();
  realCtx.appDiyApi = undefined;
}
```

- [ ] **Step 7: Run pnpm check**

Run: `cd vibes.diy && pnpm check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add pkg/app/vibes-diy-provider.tsx vibe/srv-sandbox/srv-sandbox.ts
git commit -m "feat(client): create second VibesDiyApi for AppSessions, route doc ops through /api/app"
```

---

## Design decisions

1. **UserNotify stays external.** AppSessions registers with UserNotify using the vibe key as shardId, but UserNotify only fans out to CHAT_SESSIONS. Full AppSessions delivery is a follow-up (requires UserNotify to learn about APP_SESSIONS binding).

2. **CLI cross-script binding.** CLI's APP_SESSIONS is bound to prod's script (`script_name = "vibes-diy-v2-prod"`). CLI users connecting to `/api/app?vibe=...` share the same DO instance as prod viewers — local broadcast reaches everyone. Same pattern as DocNotify/UserNotify.

3. **subscribeUserNotifications on both DOs.** Registered on AppSessions Evento for forward compatibility, but user notifications still flow through ChatSessions. No functional change until UserNotify is updated.

4. **ChatSessions unchanged.** No files in the ChatSessions path are modified. Both DOs can run independently. Misrouted messages get "Not Implemented" from the wildcard handler.

5. **Lazy QuickJS initialization.** The WASM module is NOT loaded in the DO constructor or at module level. It's loaded on first access function evaluation and cached on the DO instance. This keeps WebSocket accept fast.
