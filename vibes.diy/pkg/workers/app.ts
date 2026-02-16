/// <reference types="vite/client" />

import {
  ExecutionContext,
  ExportedHandler,
  Request as CFRequest,
  Response as CFResponse,
  CacheStorage,
} from "@cloudflare/workers-types";
import { createRequestHandler } from "react-router";

// @ts-expect-error - virtual module provided by React Router
import * as serverBuild from "virtual:react-router/server-build";
import { Env } from "./env.js";
import { cfServe, CfCacheIf } from "@vibes.diy/api-svc";
import { CFInjectMutable, cfServeAppCtx } from "@vibes.diy/api-svc/cf-serve.js";
import { processScreenShotEvent } from "./screen-shotter.js";

export { ChatSessions } from "./chat-sessions.js";
// import { cfServe } from "@vibes.diy/api-svc";
// import { CfCacheIf } from "@vibes.diy/api-svc/api.js";

declare const caches: CacheStorage;
// declare const import { meta: { env: Record<string, string> } }
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

// declare const WebSocketPair: typeof WebSocketPairType;

// class NoCache implements CfCacheIf {
//   async match() {
//     return undefined;
//   }
//   async put() {
//     // no-op
//   }
//   async delete() {
//     return false;
//   }
//   async keys() {
//     return [];
//   }
// }

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const id = env.CHAT_SESSIONS.idFromName("global");
      const obj = env.CHAT_SESSIONS.get(id);
      return obj.fetch(request); // handle WebSocket upgrade and API requests in the chat sessions Durable Object
    }

    const cctx = ctx as unknown as ExecutionContext & CFInjectMutable;
    // cctx.cache = new NoCache() as unknown as CfCacheIf; // Disable caching for now - can implement custom caching logic in the future if needed
    cctx.cache = caches.default as unknown as CfCacheIf; // Use Cloudflare's default cache
    const cfCtx = await cfServeAppCtx(request, env, cctx);
    cctx.appCtx = cfCtx.appCtx;

    if (url.hostname.endsWith(env.VIBES_SVC_HOSTNAME_BASE)) {
      return cfServe(request, cctx);
    }

    // console.log("Handling request for", cfCtx.vibesCtx.params);

    // Delegate to React Router for SSR
    return requestHandler(request as unknown as Parameters<typeof requestHandler>[0], {
      vibeDiyAppParams: cfCtx.vibesCtx.params,
    }) as unknown as CFResponse;
  },

  async queue(batch, env: Env) {
    // Queue consumer handler - processes messages from VIBES_SERVICE queue
    for (const message of batch.messages) {
      try {
        console.log("Queue message received:", message.id);
        await processScreenShotEvent(message.body, env);
        message.ack();
      } catch (error) {
        console.error("Failed to process queue message:", error);
        message.retry();
      }
    }
  },
} satisfies ExportedHandler<Env>;
