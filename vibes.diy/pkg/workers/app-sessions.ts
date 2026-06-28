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
import { CFEnv, isBuildNotification, type EvtUserNotification, type ShardIdentity } from "@vibes.diy/api-types";
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
  // Per-DO cache of access.js source bytes keyed by access-fn CID. The source is
  // content-addressed/immutable per CID, so a hit never goes stale; this removes
  // the per-write storage (R2) round-trip on access-bound vibes. The DO is
  // sharded per vibe, so only a handful of CIDs ever land here (one per access.js
  // edit). Mirrors quickjsModule above. See #2512.
  private accessFnSourceCache: Map<string, string> = new Map<string, string>();

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
    (cctx as CFInjectMutable).cache = caches.default as unknown as CfCacheIf;
    cctx.webSocket = {
      connections: this.connections,
      webSocketPair: cfWebSocketPair,
    };
    const broadcastCbs = localBroadcastCallbacks(this.connections, this.env);
    const quickjsRef = this.quickjsModule;
    const accessFnSourceCache = this.accessFnSourceCache;
    const currentVibeKey = this.vibeKey;
    const userCbs = currentVibeKey !== undefined ? userNotifyCallbacksForAppSessions(currentVibeKey, this.env) : {};

    cctx.appCtx = (
      await cfServeAppCtx(request, this.env, cctx, {
        ...broadcastCbs,
        ...userCbs,
        invokeAccessFn: (params: Parameters<typeof localInvokeAccessFn>[1]) => localInvokeAccessFn(quickjsRef, params),
        accessFnSourceCache,
      })
    ).appCtx;

    // AppSessions is the "vibe" shard: stamp its identity so the runtime gate
    // (#2714) can fail-loud on a wrong-shard request before any write/broadcast.
    // An absent vibe key intentionally yields shardId "" — a never-matching
    // identity (fail-closed). Do NOT "fix" the `?? ""` into anything permissive:
    // the vibe kind IS identity-checked, so a real key must address this shard.
    cctx.appCtx.set("shardIdentity", { kind: "vibe", shardId: currentVibeKey ?? "" } satisfies ShardIdentity);

    return cfServe(request, cctx, appMsgEvento);
  }
}
