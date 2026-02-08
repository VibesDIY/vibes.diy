import { ExecutionContext, ExportedHandler, Request as CFRequest, Response as CFResponse, CacheStorage } from "@cloudflare/workers-types";
import { createRequestHandler } from "react-router";

// @ts-expect-error - virtual module provided by React Router
import * as serverBuild from "virtual:react-router/server-build";
import { Env } from "./env.js";

export { ChatSessions } from "./chat-sessions.js";
import { cfServe, CFInject } from "@vibes.diy/api-svc/cf-serve.js";
import { CfCacheIf } from "@vibes.diy/api-svc/api.js";
import { WSSendProvider } from "@vibes.diy/api-svc/svc-ws-send-provider.js";

declare const caches: CacheStorage & { default: CfCacheIf };
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const id = env.CHAT_SESSIONS.idFromName("global");
      const obj = env.CHAT_SESSIONS.get(id);
      return obj.fetch(request);
    }
    if (url.hostname.endsWith(env.VIBES_SVC_HOSTNAME_BASE) && !url.pathname.startsWith("/dist/") && !url.pathname.startsWith("/serve/")) {
      const cctx = {
        ...ctx,
        cache: caches.default,
        connections: new Set<WSSendProvider>(),
        webSocketPair: () => {
          throw new Error("WebSocket not supported in app worker");
        },
      } as unknown as ExecutionContext & CFInject;
      return cfServe(request, env, cctx);
    }

    // Delegate to React Router for SSR
    return requestHandler(request as unknown as Parameters<typeof requestHandler>[0], {
      cloudflare: { env, ctx },
    }) as unknown as CFResponse;
  },
} satisfies ExportedHandler<Env>;
