import {
  Request as CFRequest,
  Response as CFResponse,
  ExecutionContext,
  WebSocket as CFWebSocket,
  CfProperties,
} from "@cloudflare/workers-types";
import { createAppContext, processRequest, VibesSqlite } from "./create-handler.js";
import { drizzle } from "drizzle-orm/d1";
import { CfCacheIf } from "./api.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { vibesMsgEvento } from "./vibes-msg-evento.js";
import { Env } from "./cf-env.js";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { Lazy } from "@adviser/cement";
import { hashObjectSync } from "@fireproof/core-runtime";

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

export interface CFInject {
  readonly cache: CfCacheIf;
  readonly webSocket?: {
    readonly connections: Set<WSSendProvider>;
    readonly webSocketPair: () => { client: WebSocket; server: WebSocket };
  };
  readonly drizzle?: VibesSqlite;
  readonly wsResponse?: Response;
  readonly llmRequest?: (prompt: LLMRequest) => Promise<Response>;
  // readonly db?: D1Database;
}

export async function cfServe(request: CFRequest, env: Env, ctx: ExecutionContext & CFInject): Promise<CFResponse> {
  const appCtx = await createAppContext({
    connections: ctx.webSocket?.connections ?? new Set() /* need no connections if not WS */,
    db: ctx.drizzle ?? drizzle(env.DB),
    cache: ctx.cache,
    // this help to provide enough uniqueness
    // to find clients which try to steal tokens
    netHash: Lazy(() => {
      const {
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
      } = request.cf as CfProperties; // <CfHostMetadata>
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
    }),
    llmRequest: ctx.llmRequest,
    env: env as unknown as Record<string, string>,
  });
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

  const wsEvento = vibesMsgEvento();

  server.addEventListener("message", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  });

  server.addEventListener("close", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "CloseEvent", event }, send: wsSendProvider });
    ws.connections.delete(wsSendProvider);
  });

  server.addEventListener("error", (event: Event) => {
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
