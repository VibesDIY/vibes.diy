import {
  Request as CFRequest,
  Response,
  ExecutionContext,
  WebSocket,
  WebSocketPair,
  D1Database,
  Fetcher,
} from "@cloudflare/workers-types";
import { createHandler } from "./create-handler.ts";
import { drizzle } from "drizzle-orm/d1";
import { CfCacheIf } from "./api.ts";
// import { resWellKnownJwks } from "./well-known-jwks.js";

export interface Env {
  DB: D1Database;
  // CLERK_SECRET_KEY: string;
  ASSETS: Fetcher;

  MAX_TENANTS?: number;
  MAX_ADMIN_USERS?: number;
  MAX_MEMBER_USERS?: number;
  MAX_INVITES?: number;
  MAX_LEDGERS?: number;
  MAX_APPID_BINDINGS?: number;

  CLERK_PUBLISHABLE_KEY: string;
  CLOUD_SESSION_TOKEN_PUBLIC: string;
}

export async function cfWsServe(request: CFRequest, env: Env, ctx: ExecutionContext & { cache: CfCacheIf }): Promise<Response> {
  const fn = await createHandler({
    db: drizzle(env.DB),
    cache: ctx.cache,
    env: env as unknown as Record<string, string>,
    waitUntil: (p) => ctx.waitUntil(p),
  });

  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader !== "websocket") {
    return fn(request as unknown as Request) as unknown as Promise<Response>;
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair) as [WebSocket, WebSocket];

  server.accept();

  server.addEventListener("message", (event) => {
    fn({ type: "MessageEvent", event });
  });

  server.addEventListener("close", (event) => {
    fn({ type: "CloseEvent", event });
  });

  server.addEventListener("error", (event) => {
    fn({ type: "ErrorEvent", event });
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
