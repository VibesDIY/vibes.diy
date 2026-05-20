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
import { cfServe, CfCacheIf } from "@vibes.diy/api-svc";
import { CFInjectMutable, cfServeAppCtx, isInternalReferer } from "@vibes.diy/api-svc/cf-serve.js";
import { BuildURI, NPMPackage, URI } from "@adviser/cement";
import { CFEnv } from "@vibes.diy/api-types";
import { routeDecision } from "./route-decision.js";

export { ChatSessions } from "./chat-sessions.js";
export { DocNotify } from "./doc-notify.js";
// import { cfServe } from "@vibes.diy/api-svc";
// import { CfCacheIf } from "@vibes.diy/api-svc/api.js";

declare const caches: CacheStorage;
// declare const import { meta: { env: Record<string, string> } }

// Lazy-initialize to avoid exceeding CF Worker startup CPU limit (error 10021).
// createRequestHandler processes the full React Router server build manifest;
// running it at module level counts against the startup CPU budget before the
// first fetch handler is even registered.
let _requestHandler: ReturnType<typeof createRequestHandler> | undefined;
function getRequestHandler() {
  if (!_requestHandler) {
    _requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);
  }
  return _requestHandler;
}

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
  async fetch(request: CFRequest, env: CFEnv, ctx: ExecutionContext): Promise<CFResponse> {
    const url = URI.from(request.url);
    const route = routeDecision({
      hostname: url.hostname,
      pathname: url.pathname,
      method: request.method,
      hostnameBase: env.VIBES_SVC_HOSTNAME_BASE,
    });

    if (route === "api-do") {
      const shard = url.getParam("shard") ?? crypto.randomUUID();
      const id = env.CHAT_SESSIONS.idFromName(shard);
      const obj = env.CHAT_SESSIONS.get(id);
      return obj.fetch(request); // handle WebSocket upgrade and API requests in the chat sessions Durable Object
    }

    if (route === "vibe-pkg") {
      // console.log("Handling package vibe-pkg request for", url.pathname);
      const cache = caches.default;
      if (request.method === "OPTIONS") {
        const response = new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Cache-Control": "public, max-age=86400",
          },
        }) as unknown as CFResponse;
        await cache.put(
          new Request(request.url, { method: "OPTIONS" }) as unknown as CFRequest,
          response.clone() as unknown as CFResponse
        );
        return response;
      }
      // const npm = BuildURI.from(request.url).pathname(reqUrl.pathname.replace("/vibe-pkg/", "/_vibe-pkg/")).URI();
      // assetUrl.pathname = assetUrl.pathname.replace("/vibe-pkg/", "/_vibe-pkg/");
      // request.url = assjetUrl.toString();
      const npkg = NPMPackage.parse(URI.from(request.url).pathname.replace("/vibe-pkg/", ""));
      const path = `${npkg.pkg}${npkg.suffix ?? ""}`;
      let assetResponse: CFResponse | undefined;
      for (let tryPath of [path, `${path}/index.js`]) {
        tryPath = tryPath.replace(/\/+/g, "/");
        const assetUrl = BuildURI.from(request.url).pathname("/").appendRelative("/_vibe-pkg").appendRelative(tryPath).toString();
        console.log("Trying to fetch asset for package", assetUrl);
        assetResponse = await env.ASSETS.fetch(new Request(assetUrl) as unknown as CFRequest);
        if (assetResponse.ok) {
          break;
        }
      }
      if (!assetResponse) {
        // this is to make ts happy - in practice, assetResponse should always be defined here
        // it's only for TS
        return new Response(`Asset not found for package ${npkg.pkg} with subpath ${npkg.suffix}`, {
          status: 404,
        }) as unknown as CFResponse;
      }
      const headers = new Headers(Object.fromEntries(assetResponse.headers.entries()));
      headers.set("Content-Type", "application/javascript");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      // 60s TTL: /vibe-pkg/ URLs aren't versioned, so a longer cache window
      // strands prompt/package edits at the CDN edge for that long after
      // each deploy. Until URLs carry a per-deploy version stamp, cap stale-
      // ness at one minute so deploys propagate predictably.
      headers.set("Cache-Control", "public, max-age=60");
      const response = new Response(assetResponse.body as unknown as BodyInit, {
        status: assetResponse.status,
        headers,
      }) as unknown as CFResponse;
      console.log("Caching asset response for package", path, "with status", response.status, request.url);
      await cache.put(
        new Request(request.url, { method: "GET" }) as unknown as CFRequest,
        response.clone() as unknown as CFResponse
      );
      return response;
    }

    const cctx = ctx as unknown as ExecutionContext & CFInjectMutable;
    // cctx.cache = new NoCache() as unknown as CfCacheIf; // Disable caching for now - can implement custom caching logic in the future if needed
    cctx.cache = caches.default as unknown as CfCacheIf; // Use Cloudflare's default cache
    const cfCtx = await cfServeAppCtx(request, env, cctx);
    cctx.appCtx = cfCtx.appCtx;

    // console.log("Handling request for", url, "base", env.VIBES_SVC_HOSTNAME_BASE, Object.fromEntries(request.headers.entries()));
    if (route === "cf-serve") {
      // console.log("Handling Hostname-based API request for", url.hostname, url.pathname);
      const res = await cfServe(request, cctx);
      // Don't cache asset uploads — same URL, different content per request.
      if (url.pathname !== "/assets") {
        caches.default.put(request.url, res.clone() as unknown as CFResponse);
      }
      return res;
    }

    // Reports SPA — static SPA bundled to build/client/reports/. The
    // ASSETS binding serves it; the Vite build pins base to /reports/ so
    // its hashed asset URLs resolve correctly.
    if (route === "reports-asset") {
      return env.ASSETS.fetch(request);
    }

    // Reports config.json — exposes the public env vars the static SPA
    // needs at boot (Clerk publishable key). Kept minimal: anything that
    // can be derived client-side (e.g. api URL from window.location) stays
    // out of this payload.
    if (route === "reports-config") {
      // Type-tagged envelope so the SPA can arktype-validate at the
      // env boundary (matches the rules-bag "every transferred object
      // needs implicit type matching" pattern).
      const body = JSON.stringify({
        type: "vibes.diy.reports-config",
        clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY,
      });
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Short cache: rotating the Clerk key shouldn't require a worker
          // redeploy + cache flush. 60s is enough to absorb tab refreshes
          // without going stale on a real rotation.
          "Cache-Control": "public, max-age=60",
        },
      }) as unknown as CFResponse;
    }

    // Hashed static assets (Vite fingerprinted) — cache immutably
    if (route === "static-asset") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (!assetResponse.ok) {
        return assetResponse as unknown as CFResponse;
      }
      const headers = new Headers(Object.fromEntries(assetResponse.headers.entries()));
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      return new Response(assetResponse.body as unknown as BodyInit, {
        status: assetResponse.status,
        headers,
      }) as unknown as CFResponse;
    }

    // Log external referers for attribution — this is where page navigations land
    const referer = request.headers.get("Referer");
    if (referer) {
      const rRefUri = URI.fromResult(referer);
      const rReqUri = URI.fromResult(request.url);
      if (rRefUri.isErr() || rReqUri.isErr()) {
        console.log("[referer] malformed", referer, request.method, request.url);
      } else {
        const refHostname = rRefUri.Ok().hostname;
        const reqHostname = rReqUri.Ok().hostname;
        if (!isInternalReferer(refHostname) && refHostname !== reqHostname) {
          console.log("[referer]", rRefUri.Ok().toString(), request.method, rReqUri.Ok().pathname);
        }
      }
    }

    // Delegate to React Router for SSR
    return getRequestHandler()(request as unknown as Parameters<ReturnType<typeof createRequestHandler>>[0], {
      vibeDiyAppParams: cfCtx.vibesCtx.params,
    }) as unknown as CFResponse;
  },
} satisfies ExportedHandler<CFEnv>;
