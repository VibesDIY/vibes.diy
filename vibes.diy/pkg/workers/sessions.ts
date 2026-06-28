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
import { appMsgEvento } from "@vibes.diy/api-svc/app-msg-evento.js";
import { chatMsgEvento } from "@vibes.diy/api-svc/chat-msg-evento.js";
import { sharedMsgEvento } from "@vibes.diy/api-svc/shared-msg-evento.js";
import { CFEnv, isBuildNotification, type ShardIdentity } from "@vibes.diy/api-types";
import { exception2Result, URI } from "@adviser/cement";
import { type } from "arktype";
import type { QuickJSWASMModule } from "@cf-wasm/quickjs";
import { userNotifyCallbacksForAppSessions } from "./app-sessions.js";
import { userNotifyCallbacksForChatSessions } from "./chat-sessions.js";
import { userNotifyCallbacksForSharedSessions } from "./shared-sessions.js";
import { shardKindForPath } from "./route-decision.js";

// #2714 Spec B — the physical collapse. The three session DO classes
// (ChatSessions/AppSessions/SharedSessions) were the SAME handler surface opened
// against a different shard key; this unifies them into one class. The plane is
// derived per request from the path (shardKindForPath) since one class can't
// infer its kind from its identity. Per-kind wiring below replicates each former
// class's `fetch` exactly — behavior-preserving; Spec A's runtime kind+identity
// gate (injected as `shardIdentity`) is what fences correctness across planes.

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

export class Sessions implements DurableObject {
  private connections: Set<WSSendProvider> = new Set<WSSendProvider>();
  private env: CFEnv;
  // Vibe-plane identity (set from `?vibe=`); undefined on shared/codegen planes.
  private vibeKey: string | undefined;
  // Lazy QuickJS cache for local access-fn eval (vibe + codegen planes). The
  // shared plane never wires invokeAccessFn, so a shared instance never touches
  // this and never parses QuickJS (#2714 Phase A lazy-load).
  private quickjsModule: { module: QuickJSWASMModule | null } = { module: null };
  // Vibe-plane access.js source cache, keyed by access-fn CID (see #2512).
  private accessFnSourceCache: Map<string, string> = new Map<string, string>();

  constructor(_state: DurableObjectState, env: CFEnv) {
    this.env = env;
  }

  async fetch(request: CFRequest): Promise<CFResponse> {
    if (request.method === "POST") {
      const url = URI.from(request.url);
      if (url.pathname === "/user-notify") {
        return this.deliverUserNotify(request);
      }
      return new Response("unknown POST", { status: 400 });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const uri = URI.from(request.url);
    const kind = shardKindForPath(uri.pathname);
    // app.ts only routes /api/app, /api/shared and /api(/*) here, so the kind is
    // always one of the three planes. Warn loudly if some other path ever reaches
    // a session DO — a new route added without a matching shardKindForPath branch
    // would otherwise silently default to "codegen" (Charlie review, #2766).
    if (!uri.pathname.startsWith("/api")) {
      console.warn("[Sessions] unexpected WS path, defaulting to codegen kind:", uri.pathname);
    }

    const cctx = {} as unknown as ExecutionContext & CFInjectMutable;
    (cctx as CFInjectMutable).cache = caches.default as unknown as CfCacheIf;
    cctx.webSocket = {
      connections: this.connections,
      webSocketPair: cfWebSocketPair,
    };

    const quickjsRef = this.quickjsModule;
    let overrides: Record<string, unknown>;
    let shardId: string;
    let evento: typeof appMsgEvento;

    if (kind === "vibe") {
      this.vibeKey = uri.getParam("vibe") ?? this.vibeKey;
      const vibeKey = this.vibeKey;
      overrides = {
        ...localBroadcastCallbacks(this.connections, this.env),
        ...(vibeKey !== undefined ? userNotifyCallbacksForAppSessions(vibeKey, this.env) : {}),
        invokeAccessFn: (params: Parameters<typeof localInvokeAccessFn>[1]) => localInvokeAccessFn(quickjsRef, params),
        accessFnSourceCache: this.accessFnSourceCache,
      };
      // An absent vibe key intentionally yields shardId "" — a never-matching
      // identity (fail-closed). The vibe kind IS identity-checked, so a real key
      // must address this shard.
      shardId = vibeKey ?? "";
      evento = appMsgEvento;
    } else if (kind === "codegen") {
      const shard = uri.getParam("shard");
      overrides = {
        ...(shard !== undefined ? userNotifyCallbacksForChatSessions(shard, this.env) : {}),
        // Local QuickJS eval for ensureAppSlugItem's access-binding backfill — the
        // one codegen-plane access-fn consumer (#2265 A2b).
        invokeAccessFn: (params: Parameters<typeof localInvokeAccessFn>[1]) => localInvokeAccessFn(quickjsRef, params),
      };
      shardId = shard ?? "";
      evento = chatMsgEvento;
    } else {
      // shared: stateless reads only — no broadcast, no invokeAccessFn (never
      // parses QuickJS).
      const shard = uri.getParam("shard");
      overrides = shard !== undefined ? userNotifyCallbacksForSharedSessions(shard, this.env) : {};
      shardId = shard ?? "";
      evento = sharedMsgEvento;
    }

    cctx.appCtx = (await cfServeAppCtx(request, this.env, cctx, overrides)).appCtx;
    cctx.appCtx.set("shardIdentity", { kind, shardId } satisfies ShardIdentity);
    return cfServe(request, cctx, evento);
  }

  // Internal POST fan-out target: UserNotify delivers a notification to every
  // local connection subscribed to the target user. Plane-agnostic (delivery is
  // by subscribedUserKey, not shard kind) — identical to the former three
  // classes' handlers, written once here.
  private async deliverUserNotify(request: CFRequest): Promise<CFResponse> {
    const rJson = await exception2Result(() => request.json());
    if (rJson.isErr()) return new Response("Invalid JSON", { status: 400 });
    const parsed = UserNotifyDelivery(rJson.Ok());
    if (parsed instanceof type.errors) return new Response("Invalid notification", { status: 400 });

    const { evt, senderConnId, targetUserId } = parsed;
    let delivered = 0;
    for (const conn of this.connections) {
      if (conn.subscribedUserKey !== targetUserId) continue;
      // Build notifications fan out to every connection, including the originating
      // tab/device, so the click can focus that device and route to the vibe.
      // Other notification types still skip the originator.
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
      "[Sessions] user-notify",
      evt.notificationType,
      evt.ownerHandle + "/" + evt.appSlug,
      "| delivered to",
      delivered,
      "connections"
    );
    return new Response("ok");
  }
}
