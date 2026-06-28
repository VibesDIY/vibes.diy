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
import { CFInjectMutable, cfServeAppCtx, localInvokeAccessFn } from "@vibes.diy/api-svc/cf-serve.js";
import { chatMsgEvento } from "@vibes.diy/api-svc/chat-msg-evento.js";
import {
  CFEnv,
  isBuildNotification,
  isUserNotifyShard,
  userNotifyShardFor,
  type EvtUserNotification,
  type ShardIdentity,
} from "@vibes.diy/api-types";
import { exception2Result, URI } from "@adviser/cement";
import { type } from "arktype";
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
// declare const DurableObject: typeof DurableObject;
declare const WebSocketPair: typeof WebSocketPairType;

function cfWebSocketPair(): { client: WebSocket; server: WebSocket } {
  // console.log("cfWebSocketPair called-1", WebSocketPair);
  const webSocketPair = new WebSocketPair();
  // console.log("cfWebSocketPair called-2", WebSocketPair);
  const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];
  return { client: client as unknown as WebSocket, server: server as unknown as WebSocket };
}

// Wires user-notification callbacks for a ChatSessions connection.
//
// `notifyUser` (the EMITTER) is wired UNCONDITIONALLY. Codegen runs on this chat
// plane and finishes here — prompt-chat-section's `.finally` emits build-complete /
// build-failed via `vctx.notifyUser`. But a codegen connection uses a random-UUID
// shard (not a stable `notify-user-<userId>` shard), so gating the emitter on
// isUserNotifyShard (as registration is) would drop every build notification —
// `vctx.notifyUser` would be undefined and the emit silently skipped. Emitting is
// safe from any shard; it only POSTs to the target user's UserNotify DO. (#2265 B)
//
// Registration (receive-side) stays bounded to the stable per-user notify shard:
// codegen chat connections use random-UUID shards, and registering those would leak
// unbounded dead shards into UserNotify, which never prunes a shard that still
// resolves to a DO.
// Exported for testability (chat-sessions-notify.test.ts).
export function userNotifyCallbacksForChatSessions(shard: string, env: CFEnv) {
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

  const notifyUser = async (userId: string, evt: EvtUserNotification, senderConnId: string): Promise<void> => {
    await fetchUserNotify(userId, {
      action: "notify",
      targetUserId: userId,
      senderShardId: `chat:${shard}`,
      senderConnId,
      evt,
    });
  };

  // Non-notify shard (e.g. a random-UUID codegen connection): emit only, no
  // registration. This is the path that delivers build-complete from codegen.
  if (!isUserNotifyShard(shard)) return { notifyUser };

  return {
    notifyUser,
    registerUserSubscription: async (userId: string): Promise<void> => {
      // The `?shard=` param is client-supplied on the public /api path, so only let a
      // connection register the shard that belongs to its OWN authenticated user. This
      // ties the (otherwise arbitrary) shard to the verified userId and keeps the bound
      // at one shard per user — a client can't inflate UserNotify with forged shards.
      if (shard !== userNotifyShardFor(userId)) {
        // Expected only on a forged shard, or if the client's DO-name id (clerk.user.id)
        // ever drifts from the server's claims.userId — in which case notification
        // registration silently no-ops, so surface it for telemetry.
        console.warn("[ChatSessions] skip user-notify register: shard does not match authenticated user", shard.slice(0, 16));
        return;
      }
      await fetchUserNotify(userId, { action: "register", shardId: shard });
    },
    deregisterUserSubscription: async (userId: string): Promise<void> => {
      if (shard !== userNotifyShardFor(userId)) return;
      await fetchUserNotify(userId, { action: "deregister", shardId: shard });
    },
  };
}

export class ChatSessions implements DurableObject {
  private connections: Set<WSSendProvider> = new Set<WSSendProvider>();
  private env: CFEnv;
  // Lazy-cached QuickJS module for local access-fn eval. ChatSessions evaluates
  // access fns locally (like AppSessions) for the one chat-plane path that needs
  // it: ensureAppSlugItem's access-binding backfill at app-creation time. This
  // replaced the cross-DO env.ACCESS_FN_DO call (AccessFnDO retired in #2265
  // A2b/A3). Lazy — the module only loads on the first access-bound app.
  private quickjsModule: { module: QuickJSWASMModule | null } = { module: null };

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
          // Build notifications fan out to every connection, including the originating
          // tab/device, so the click can focus that device and route to the vibe. Other
          // notification types still skip the originator.
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
          "[ChatSessions] user-notify",
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

    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    (cctx as CFInjectMutable).cache = caches.default as unknown as CfCacheIf;
    cctx.webSocket = {
      connections: this.connections,
      webSocketPair: cfWebSocketPair,
    };
    const shard = URI.from(request.url).getParam("shard");
    const userCbs = shard !== undefined ? userNotifyCallbacksForChatSessions(shard, this.env) : {};
    const quickjsRef = this.quickjsModule;
    cctx.appCtx = (
      await cfServeAppCtx(request, this.env, cctx, {
        ...userCbs,
        // Local QuickJS eval, not env.ACCESS_FN_DO. Used by ensureAppSlugItem's
        // access-binding backfill (the last chat-plane consumer). (#2265 A2b)
        invokeAccessFn: (params: Parameters<typeof localInvokeAccessFn>[1]) => localInvokeAccessFn(quickjsRef, params),
      })
    ).appCtx;
    // ChatSessions is the "codegen" shard: stamp its identity (the per-stream
    // shard id) so the runtime gate (#2714) can fail-loud on a wrong-shard request.
    cctx.appCtx.set("shardIdentity", { kind: "codegen", shardId: shard ?? "" } satisfies ShardIdentity);
    return cfServe(request, cctx, chatMsgEvento);
  }
}
