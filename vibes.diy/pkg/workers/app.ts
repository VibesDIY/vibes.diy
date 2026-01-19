import {
  D1Database,
  ExecutionContext,
  ExportedHandler,
  CacheStorage,
  Fetcher,
  Request as CFRequest,
  Response as CFResponse,
} from "@cloudflare/workers-types";
import { createRequestHandler } from "react-router";
import { cfServe } from "@vibes.diy/api-svc";

// @ts-expect-error - virtual module provided by React Router
import * as serverBuild from "virtual:react-router/server-build";
import { CfCacheIf } from "@vibes.diy/api-svc/api.js";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  ENVIRONMENT: string;
  VIBES_SVC_HOSTNAME_BASE: string;
  // Add more bindings here as needed
}

declare const caches: CacheStorage;
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    const url = new URL(request.url);
    // console.log("Request URL:", url.hostname, env);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/") || url.hostname.endsWith(env.VIBES_SVC_HOSTNAME_BASE)) {
      const cctx = ctx as unknown as ExecutionContext & { cache: CfCacheIf };
      cctx.cache = caches.default as unknown as CfCacheIf;
      console.log("Doing cfServe for", url.href);
      return cfServe(request, env, cctx);
    }

    // Delegate to React Router for SSR
    return requestHandler(request as unknown as Parameters<typeof requestHandler>[0], {
      cloudflare: { env, ctx },
    }) as unknown as CFResponse;
  },
} satisfies ExportedHandler<Env>;
