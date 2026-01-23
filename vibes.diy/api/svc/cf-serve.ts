import {
  Request as CFRequest,
  Response,
  ExecutionContext,
  WebSocket as CFWebSocket,
  WebSocketPair,
  D1Database,
} from "@cloudflare/workers-types";
import { createHandler } from "./create-handler.js";
import { drizzle } from "drizzle-orm/d1";
import { CfCacheIf } from "./api.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { HTTPSendProvider } from "./svc-http-send-provider.js";
// import { resWellKnownJwks } from "./well-known-jwks.js";

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  VIBES_SVC_HOSTNAME_BASE: string;
  // Add more bindings here as needed
  MAX_TENANTS?: number;
  MAX_ADMIN_USERS?: number;
  MAX_MEMBER_USERS?: number;
  MAX_INVITES?: number;
  MAX_LEDGERS?: number;
  MAX_APPID_BINDINGS?: number;

  CLERK_PUBLISHABLE_KEY: string;
  CLOUD_SESSION_TOKEN_PUBLIC: string;
}

export async function cfServe(request: CFRequest, env: Env, ctx: ExecutionContext & { cache: CfCacheIf }): Promise<Response> {
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    const fn = await createHandler({
      db: drizzle(env.DB),
      cache: ctx.cache,
      env: env as unknown as Record<string, string>,
      waitUntil: (p) => ctx.waitUntil(p),
    });
    const httpSend = new HTTPSendProvider();
    (await fn(request as unknown as Request, {
      send: httpSend,
    })) as unknown as Promise<Response>;
    return httpSend.getResponse() as unknown as Response;
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair) as [CFWebSocket, CFWebSocket];

  server.accept();

  const wsSendProvider = new WSSendProvider(server as unknown as WebSocket);

  const fn = await createHandler({
    db: drizzle(env.DB),
    cache: ctx.cache,
    env: env as unknown as Record<string, string>,
    waitUntil: (p) => ctx.waitUntil(p),
  });
  server.addEventListener("message", (event) => {
    fn({ type: "MessageEvent", event }, { send: wsSendProvider });
  });

  server.addEventListener("close", (event) => {
    fn({ type: "CloseEvent", event }, { send: wsSendProvider });
  });

  server.addEventListener("error", (event) => {
    fn({ type: "ErrorEvent", event }, { send: wsSendProvider });
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
