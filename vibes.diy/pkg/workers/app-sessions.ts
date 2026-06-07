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
import { CFEnv, type EvtUserNotification } from "@vibes.diy/api-types";
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

function userNotifyCallbacksForAppSessions(vibeKey: string, env: CFEnv) {
  const shardId = `app:${vibeKey}`;

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
    notifyUser: async (userId: string, evt: EvtUserNotification, senderConnId: string): Promise<void> => {
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

export class AppSessions implements DurableObject {
  private connections: Set<WSSendProvider> = new Set<WSSendProvider>();
  private env: CFEnv;
  private vibeKey: string | undefined;
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

    // Extract vibe key from URL for sharding
    const uri = URI.from(request.url);
    this.vibeKey = uri.getParam("vibe") ?? this.vibeKey;

    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    cctx.cache = caches.default as unknown as CfCacheIf;
    cctx.webSocket = {
      connections: this.connections,
      webSocketPair: cfWebSocketPair,
    };
    const broadcastCbs = localBroadcastCallbacks(this.connections, this.env);
    const quickjsRef = this.quickjsModule;
    const currentVibeKey = this.vibeKey;
    const userCbs = currentVibeKey !== undefined ? userNotifyCallbacksForAppSessions(currentVibeKey, this.env) : {};

    cctx.appCtx = (
      await cfServeAppCtx(request, this.env, cctx, {
        ...broadcastCbs,
        ...userCbs,
        invokeAccessFn: (params: Parameters<typeof localInvokeAccessFn>[1]) => localInvokeAccessFn(quickjsRef, params),
      })
    ).appCtx;

    return cfServe(request, cctx, appMsgEvento);
  }
}
