import {
  CacheStorage,
  ExecutionContext,
  ExportedHandler,
  Request as CFRequest,
  Response as CFResponse,
} from "@cloudflare/workers-types";
import { createRequestHandler } from "react-router";

// @ts-expect-error - virtual module provided by React Router
import * as serverBuild from "virtual:react-router/server-build";
import { Env } from "./env.js";
import { CfCacheIf } from "@vibes.diy/api-svc/api.js";
import { cfServe } from "@vibes.diy/api-svc";

export { ChatSessions } from "./chat-sessions.js";
// import { cfServe } from "@vibes.diy/api-svc";
// import { CfCacheIf } from "@vibes.diy/api-svc/api.js";

declare const caches: CacheStorage;
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

// declare const WebSocketPair: typeof WebSocketPairType;

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const id = env.CHAT_SESSIONS.idFromName("global");
      const obj = env.CHAT_SESSIONS.get(id);
      return obj.fetch(request); // handle WebSocket upgrade and API requests in the chat sessions Durable Object
    }
    if (url.hostname.endsWith(env.VIBES_SVC_HOSTNAME_BASE)) {
      const cctx = ctx as unknown as ExecutionContext & { cache: CfCacheIf };
      cctx.cache = caches.default as unknown as CfCacheIf;
      console.log("Doing cfServe for", url.href);
      return cfServe(request, env, cctx);
      // throw new Error("cfServe path disabled in app worker");
    }

    // Delegate to React Router for SSR
    return requestHandler(request as unknown as Parameters<typeof requestHandler>[0], {
      cloudflare: { env, ctx },
    }) as unknown as CFResponse;
  },
} satisfies ExportedHandler<Env>;
