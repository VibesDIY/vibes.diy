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
import { CFEnv, isUserNotificationEvent, UserNotificationEvent, userNotificationSubscriptionKey } from "@vibes.diy/api-types";
import { exception2Result, URI } from "@adviser/cement";
import { type } from "arktype";

const DocChangedEvt = type({
  type: "'vibes.diy.evt-doc-changed'",
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
  docId: "string",
});

const RequestGrantEvt = type({
  type: "'vibes.diy.evt-request-grant'",
  op: "'upsert' | 'delete'",
  userId: "string",
  grant: type({
    userSlug: "string",
    appSlug: "string",
  }).and(type("Record<string, unknown>")),
}).and(type("Record<string, unknown>"));

const DocNotifyEvt = DocChangedEvt.or(RequestGrantEvt);

// Internal POST body from DocNotify: the doc-changed event plus the
// originating WebSocket's connId, so we can skip just that one connection
// while still delivering to sibling tabs/browsers on the same shard.
const DocNotifyDelivery = type({
  evt: DocNotifyEvt,
  senderConnId: "string",
  "subscriptionKey?": "string",
});

const UserNotifyDelivery = type({
  evt: type("Record<string, unknown>"),
  senderConnId: "string",
  userId: "string",
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

export class ChatSessions implements DurableObject {
  private connections: Set<WSSendProvider> = new Set<WSSendProvider>();
  private env: CFEnv;
  private shardId: string | undefined;

  constructor(_state: DurableObjectState, env: CFEnv) {
    this.env = env;
  }

  private subscriptionKeyFromEvent(evt: typeof DocNotifyEvt.infer): string | undefined {
    switch (evt.type) {
      case "vibes.diy.evt-doc-changed":
        return `${evt.userSlug}/${evt.appSlug}/${evt.dbName}`;
      case "vibes.diy.evt-request-grant":
        return `${evt.grant.userSlug}/${evt.grant.appSlug}`;
    }
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    // Internal notification from DocNotify coordinator — broadcast to local subscribers
    if (request.method === "POST") {
      const rJson = await exception2Result(() => request.json());
      if (rJson.isErr()) {
        return new Response("Invalid JSON", { status: 400 });
      }
      const raw = rJson.Ok();
      const parsedDoc = DocNotifyDelivery(raw);
      const parsedUser = UserNotifyDelivery(raw);

      let evt: typeof DocNotifyEvt.infer | UserNotificationEvent;
      let senderConnId: string;
      let subscriptionKey: string | undefined;

      if (!(parsedDoc instanceof type.errors)) {
        evt = parsedDoc.evt;
        senderConnId = parsedDoc.senderConnId;
        subscriptionKey = parsedDoc.subscriptionKey ?? this.subscriptionKeyFromEvent(parsedDoc.evt);
      } else if (!(parsedUser instanceof type.errors)) {
        if (!isUserNotificationEvent(parsedUser.evt)) {
          return new Response("Invalid notification", { status: 400 });
        }
        evt = parsedUser.evt;
        senderConnId = parsedUser.senderConnId;
        subscriptionKey = userNotificationSubscriptionKey(parsedUser.userId);
      } else {
        return new Response("Invalid notification", { status: 400 });
      }

      if (!subscriptionKey) {
        return new Response("Missing subscriptionKey", { status: 400 });
      }
      let delivered = 0;
      let skippedSender = 0;
      for (const conn of this.connections) {
        const subscribed =
          conn.subscribedDocKeys.has(subscriptionKey) ||
          conn.subscribedRequestGrantKeys.has(subscriptionKey) ||
          conn.subscribedUserNotificationKeys.has(subscriptionKey);
        if (!subscribed) continue;
        // Skip the originating WebSocket — it already updated optimistically
        // when the put/delete returned. Sibling connections on the same
        // shard (other tabs/browsers under the same warm-DO) still receive.
        if (conn.connId === senderConnId) {
          skippedSender++;
          continue;
        }
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
      const eventDetail = `type:${evt.type}`;
      console.log(
        "[ChatSessions] received notification",
        subscriptionKey,
        eventDetail,
        "| shard:",
        (this.shardId ?? "unknown").slice(0, 8),
        "| delivered to",
        delivered,
        "of",
        this.connections.size,
        "connections (skipped sender:",
        skippedSender + ")"
      );
      // Return 410 Gone only if there are no live local connections at all.
      // If the only matching connection was the sender (skipped), that's a
      // legitimate fan-out — the shard still has subscribers, don't evict.
      if (delivered === 0 && skippedSender === 0) {
        return new Response("no connections", { status: 410 });
      }
      return new Response("ok");
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    // Extract shard ID from URL for DocNotify registration/deregistration
    const uri = URI.from(request.url);
    this.shardId = uri.getParam("shard") ?? this.shardId;

    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    cctx.cache = caches.default as unknown as CfCacheIf; // Use Cloudflare's default cache
    cctx.webSocket = {
      connections: this.connections,
      webSocketPair: cfWebSocketPair,
    };
    cctx.docNotify = this.shardId
      ? {
          shardId: this.shardId,
          env: this.env,
        }
      : undefined;
    cctx.appCtx = (await cfServeAppCtx(request, this.env, cctx)).appCtx;
    return cfServe(request, cctx);
  }
}
