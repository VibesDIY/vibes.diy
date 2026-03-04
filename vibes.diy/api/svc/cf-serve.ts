import {
  Request as CFRequest,
  Response as CFResponse,
  ExecutionContext,
  WebSocket as CFWebSocket,
  CfProperties,
  R2Bucket,
} from "@cloudflare/workers-types";
import { createAppContext, processRequest, VibesSqlite } from "./create-handler.js";
import { drizzle } from "drizzle-orm/d1";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { vibesMsgEvento } from "./vibes-msg-evento.js";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { AppContext, Lazy, LoggerImpl, Result } from "@adviser/cement";
import { ensureSuperThis, hashObjectSync } from "@fireproof/core-runtime";
import { CfCacheIf } from "./types.js";
import { CFEnv, MsgBase } from "@vibes.diy/api-types";
import { R2ToS3Api } from "./peers/r2-to-s3api.js";
import { SuperThis } from "@fireproof/core-types-base";

// declare global {
//   class WebSocketPair {
//     0: WebSocket;
//     1: WebSocket;
//   }
// }

// function cfWebSocketPair(): { client: CFWebSocket; server: CFWebSocket } {
//   console.log("cfWebSocketPair called-1", WebSocketPair);
//   const webSocketPair = new WebSocketPair();
//   console.log("cfWebSocketPair called-2", WebSocketPair);
//   const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];
//   return { client, server };
// }

export interface CFInjectMutable {
  sthis?: SuperThis;
  appCtx: AppContext;
  cache: CfCacheIf;
  webSocket?: {
    connections: Set<WSSendProvider>;
    webSocketPair: () => { client: WebSocket; server: WebSocket };
  };
  drizzle: VibesSqlite;
  assetBucket: R2Bucket;
  wsResponse?: Response;
  llmRequest?: (prompt: LLMRequest) => Promise<Response>;
  // readonly db?: D1Database;
}
export type CFInject = Readonly<CFInjectMutable>;

function netHashFn({
  colo,
  country,
  continent,
  city,
  postalCode,
  latitude,
  longitude,
  timezone,
  region,
  regionCode,
  metroCode,
  /* clientTcpRtt segmented */
}: CfProperties): string {
  return hashObjectSync({
    colo,
    country,
    continent,
    city,
    postalCode,
    latitude,
    longitude,
    timezone,
    region,
    regionCode,
    metroCode,
  });
}

export function cfDrizzle<T extends VibesSqlite>(env: CFEnv, ctxDrizzle?: T): { db: T } {
  return { db: (ctxDrizzle ?? drizzle(env.DB)) as T };
}

export async function cfServeAppCtx(request: CFRequest, env: CFEnv, ctx: ExecutionContext & Omit<CFInject, "appCtx">) {
  const netHash = Lazy(() => netHashFn(request.cf as CfProperties));
  const sthis =
    ctx.sthis ??
    ensureSuperThis({
      logger: new LoggerImpl(),
    });
  console.log("Creating app context with netHash:", sthis.nextId(12).str)
  return createAppContext({
    sthis,
    ...cfDrizzle(env, ctx.drizzle),
    s3Api: new R2ToS3Api(ctx.assetBucket, sthis),
    // db: ctx.drizzle ?? drizzle(env.DB),
    connections: ctx.webSocket?.connections ?? new Set() /* need no connections if not WS */,
    cache: ctx.cache,

    postQueue: async (msg: MsgBase) => {
      // console.log("Posting message to queue:", msg);
      await env.VIBES_SERVICE.send(JSON.stringify(msg));
    },
    fetchAsset: async (url: string) => {
      // const uri = URI.from(url);
      // const assetUrl = uri.build().pathname(uri.pathname.replace(/^\//, "/_")).toString();
      // const assetUrl = uri.toString();
      // console.log("Fetching asset from URL:", url, "assetUrl:", assetUrl);
      const res = await env.ASSETS.fetch(url);
      // console.log("Received response for asset fetch:", res);
      if (!res.ok) {
        return Result.Err(`Failed to fetch asset from ${url}: ${res.status} ${res.statusText}`);
      }
      if (!res.body) {
        return Result.Err(`No body in response when fetching asset from ${url}`);
      }
      // const text = await res.text();
      // console.log("Fetching asset from URL:", assetUrl, '->', text);
      return Result.Ok(res.body as unknown as ReadableStream<Uint8Array>);
    },
    // this help to provide enough uniqueness
    // to find clients which try to steal tokens
    netHash,
    llmRequest: ctx.llmRequest,
    env: env as unknown as Record<string, string>,
  });
}

export async function cfServe(request: CFRequest, ctx: CFInject): Promise<CFResponse> {
  const appCtx = ctx.appCtx;
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return processRequest(appCtx, request as unknown as Request) as unknown as Promise<CFResponse>;
  }
  if (!ctx.webSocket) {
    throw new Error("WebSocket upgrade requested but no webSocketPair function provided in context");
  }
  const ws = ctx.webSocket;
  const { client, server } = ctx.webSocket.webSocketPair(); // ? ctx.webSocketPair() : cfWebSocketPair();
  (server as unknown as CFWebSocket).accept();

  const wsSendProvider = new WSSendProvider(server as unknown as WebSocket);
  ws.connections.add(wsSendProvider);
  console.log("New WebSocket connection accepted", ws.connections.size);

  const wsEvento = vibesMsgEvento();

  server.addEventListener("message", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  });

  server.addEventListener("close", (event) => {
    console.log("WebSocket connection closed", ws.connections.size - 1);
    wsEvento.trigger({ ctx: appCtx, request: { type: "CloseEvent", event }, send: wsSendProvider });
    ws.connections.delete(wsSendProvider);
  });

  server.addEventListener("error", (event: Event) => {
    console.error("WebSocket error", event);
    wsEvento.trigger({ ctx: appCtx, request: { type: "ErrorEvent", event: event as ErrorEvent }, send: wsSendProvider });
    ws.connections.delete(wsSendProvider);
  });
  // cast wiredness don't ask me --- ask Cloudflare
  return (ctx.wsResponse ??
    new globalThis.Response(null, {
      status: 101,
      webSocket: client,
    } as unknown as ResponseInit)) as unknown as CFResponse;
}
