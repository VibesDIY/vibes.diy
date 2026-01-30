import {
  Request as CFRequest,
  Response as CFResponse,
  ExecutionContext,
  WebSocket as CFWebSocket,
  WebSocketPair,
} from "@cloudflare/workers-types";
import { createAppContext, processRequest, VibesSqlite } from "./create-handler.js";
import { drizzle } from "drizzle-orm/d1";
import { CfCacheIf } from "./api.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { vibesMsgEvento } from "./vibes-msg-evento.js";
import { Env } from "./cf-env.js";
import { LLMRequest } from "@vibes.diy/call-ai-v2";

declare global {
  class WebSocketPair {
    0: WebSocket;
    1: WebSocket;
  }
}

function cfWebSocketPair(): { client: CFWebSocket; server: CFWebSocket } {
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];
  return { client, server };
}

export interface CFInject {
  readonly cache: CfCacheIf;
  readonly webSocketPair?: typeof cfWebSocketPair;
  readonly drizzle?: VibesSqlite;
  readonly wsResponse?: Response;
  readonly llmRequest?: (prompt: LLMRequest) => Promise<Response>;
  // readonly db?: D1Database;
}

export async function cfServe(request: CFRequest, env: Env, ctx: ExecutionContext & CFInject): Promise<CFResponse> {
  const appCtx = await createAppContext({
    db: ctx.drizzle ?? drizzle(env.DB),
    cache: ctx.cache,
    llmRequest: ctx.llmRequest,
    env: env as unknown as Record<string, string>,
  });
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return processRequest(appCtx, request as unknown as Request) as unknown as Promise<CFResponse>;
  }
  const { client, server } = ctx.webSocketPair ? ctx.webSocketPair() : cfWebSocketPair();
  server.accept();

  const wsSendProvider = new WSSendProvider(server as unknown as WebSocket);
  const wsEvento = vibesMsgEvento();

  server.addEventListener("message", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "MessageEvent", event }, send: wsSendProvider });
  });

  server.addEventListener("close", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "CloseEvent", event }, send: wsSendProvider });
  });

  server.addEventListener("error", (event) => {
    wsEvento.trigger({ ctx: appCtx, request: { type: "ErrorEvent", event }, send: wsSendProvider });
  });
  // cast wiredness don't ask me --- ask Cloudflare
  return (ctx.wsResponse ??
    new globalThis.Response(null, {
      status: 101,
      webSocket: client,
    } as unknown as ResponseInit)) as unknown as CFResponse;
}
