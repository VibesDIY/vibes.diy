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
import { chatMsgEvento } from "@vibes.diy/api-svc/chat-msg-evento.js";
import { CFEnv, isBuildNotification, isUserNotifyShard } from "@vibes.diy/api-types";
import { exception2Result, URI } from "@adviser/cement";
import { type } from "arktype";

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

// Lets a ChatSessions connection register itself as a user-notification subscriber so
// it receives fanned-out notifications. Only the dedicated per-user notification
// connection (stable `notify-user-<userId>` shard) is allowed to register — codegen
// chat connections use random-UUID shards, and registering those would leak unbounded
// dead shards into UserNotify, which never prunes a shard that still resolves to a DO.
// Note: only the receive-side subscription is wired here (no notifyUser); build
// emission stays owned by the AppSessions path, unchanged.
function userNotifyCallbacksForChatSessions(shard: string, env: CFEnv) {
  if (!isUserNotifyShard(shard)) return {};

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

  return {
    registerUserSubscription: async (userId: string): Promise<void> => {
      await fetchUserNotify(userId, { action: "register", shardId: shard });
    },
    deregisterUserSubscription: async (userId: string): Promise<void> => {
      await fetchUserNotify(userId, { action: "deregister", shardId: shard });
    },
  };
}

export class ChatSessions implements DurableObject {
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
    cctx.appCtx = (await cfServeAppCtx(request, this.env, cctx, { ...userCbs })).appCtx;
    return cfServe(request, cctx, chatMsgEvento);
  }
}
