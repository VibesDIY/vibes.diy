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
import { CFInjectMutable, cfServeAppCtx } from "@vibes.diy/api-svc/cf-serve.js";
import { BuildURI, NPMPackage, URI } from "@adviser/cement";
import { CFEnv } from "@vibes.diy/api-types";

export { ChatSessions } from "./chat-sessions.js";
export { DocNotify } from "./doc-notify.js";
// import { cfServe } from "@vibes.diy/api-svc";
// import { CfCacheIf } from "@vibes.diy/api-svc/api.js";

declare const caches: CacheStorage;
// declare const import { meta: { env: Record<string, string> } }
const moduleInitT0 = Date.now();
console.log(`[wsperf-init] module-init at=${moduleInitT0}`);
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);
console.log(`[wsperf-init] react-router-built t=${Date.now() - moduleInitT0}`);

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
    const wsPerfT0 = Date.now();
    const wsPerfTag = crypto.randomUUID().slice(0, 8);
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      console.log(`[wsperf-entry] ${wsPerfTag} fetch-enter t=0 since-init=${wsPerfT0 - moduleInitT0}ms`);
      const shard = url.searchParams.get("shard") || crypto.randomUUID();
      console.log(`[wsperf-entry] ${wsPerfTag} shard-parsed t=${Date.now() - wsPerfT0}`);
      const id = env.CHAT_SESSIONS.idFromName(shard);
      console.log(`[wsperf-entry] ${wsPerfTag} do-id t=${Date.now() - wsPerfT0}`);
      const obj = env.CHAT_SESSIONS.get(id);
      console.log(`[wsperf-entry] ${wsPerfTag} do-stub t=${Date.now() - wsPerfT0}`);
      // Forward entry t0 + tag to DO so it can compute its gap from edge arrival.
      // new Request(req, { headers }) replaces headers — merge with existing.
      const headers = new Headers(request.headers as unknown as HeadersInit);
      headers.set("x-wsperf-entry-t0", String(wsPerfT0));
      headers.set("x-wsperf-tag", wsPerfTag);
      const forwarded = new Request(request as unknown as Request, { headers }) as unknown as CFRequest;
      const res = await obj.fetch(forwarded);
      console.log(`[wsperf-entry] ${wsPerfTag} do-returned t=${Date.now() - wsPerfT0} status=${res.status}`);
      return res;
    }

    if (url.pathname.startsWith("/vibe-pkg/")) {
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
      headers.set("Cache-Control", "public, max-age=3600");
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
    if (
      (url.hostname.endsWith(env.VIBES_SVC_HOSTNAME_BASE) &&
        url.hostname.slice(0, -env.VIBES_SVC_HOSTNAME_BASE.length).includes("--")) ||
      url.pathname.startsWith("/assets/cid")
    ) {
      // console.log("Handling Hostname-based API request for", url.hostname, url.pathname);
      const res = await cfServe(request, cctx);
      caches.default.put(request.url, res.clone() as unknown as CFResponse);
      return res;
    }

    // Hashed static assets (Vite fingerprinted) — cache immutably
    if (url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/assets/cid")) {
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

    // Delegate to React Router for SSR
    return requestHandler(request as unknown as Parameters<typeof requestHandler>[0], {
      vibeDiyAppParams: cfCtx.vibesCtx.params,
    }) as unknown as CFResponse;
  },
} satisfies ExportedHandler<CFEnv>;
