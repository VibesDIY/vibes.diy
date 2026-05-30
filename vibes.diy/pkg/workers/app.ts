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
import { sendCapiPageView, sendCapiViewContent } from "./meta-capi.js";
import { sendCapiCompleteRegistration } from "./capi-complete-registration.js";
import { verifyClerkWebhookSignature, postSignupToDiscord, ClerkUserCreatedData } from "./clerk-webhook.js";
import { getVibeRouteHints, parseVibePathname, vibePathnameHasFsId } from "@vibes.diy/api-svc/intern/get-vibe-route-hints.js";

export { ChatSessions } from "./chat-sessions.js";
export { DocNotify } from "./doc-notify.js";
export { UserNotify } from "./user-notify.js";
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

    const fbclid = url.getParam("fbclid");
    if (fbclid !== undefined && env.META_CAPI_TOKEN !== undefined && env.META_PIXEL_ID !== undefined) {
      ctx.waitUntil(sendCapiPageView(request as unknown as Request, env.META_CAPI_TOKEN, env.META_PIXEL_ID));
    }

    const route = routeDecision({
      hostname: url.hostname,
      pathname: url.pathname,
      method: request.method,
      hostnameBase: env.VIBES_SVC_HOSTNAME_BASE,
    });

    if (route === "legacy-vibe-redirect") {
      const slug = url.pathname.slice("/vibe/".length);
      // Known slug remaps: legacy single-segment slugs that belong to a different user/appSlug.
      const VIBE_SLUG_OVERRIDES: Record<string, string> = {
        "cosmic-anansi-3972": "/vibe/og/pickathon-picker",
      };
      const destination = VIBE_SLUG_OVERRIDES[slug] ?? `/vibe/og/${slug}`;
      return new Response(null, {
        status: 301,
        headers: { Location: `${destination}${url.search}` },
      }) as unknown as CFResponse;
    }

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

    if (route === "capi-relay") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "https://vibes.diy",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }) as unknown as CFResponse;
      }
      if (env.META_CAPI_TOKEN !== undefined && env.META_PIXEL_ID !== undefined) {
        const rBody = (await request.json().catch(() => undefined)) as
          | {
              fbclid?: string;
              landingUrl?: string;
              fbclidTs?: number;
              eventId?: string;
            }
          | undefined;
        if (rBody?.fbclid !== undefined && rBody.fbclid !== "" && rBody?.landingUrl !== undefined) {
          ctx.waitUntil(
            sendCapiViewContent({
              fbclid: rBody.fbclid,
              landingUrl: rBody.landingUrl,
              fbclidTs: rBody.fbclidTs,
              eventId: rBody.eventId,
              capiToken: env.META_CAPI_TOKEN,
              pixelId: env.META_PIXEL_ID,
              request: request as unknown as Request,
            })
          );
        }
      }
      return new Response(JSON.stringify({ type: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://vibes.diy" },
      }) as unknown as CFResponse;
    }

    if (route === "capi-complete-registration") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "https://vibes.diy",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }) as unknown as CFResponse;
      }
      if (env.META_CAPI_TOKEN !== undefined && env.META_PIXEL_ID !== undefined) {
        const rBody = (await request.json().catch(() => undefined)) as
          | { fbclid?: string; fbclidTs?: number; landingUrl?: string }
          | undefined;
        if (rBody?.fbclid !== undefined && rBody.fbclid !== "") {
          ctx.waitUntil(
            sendCapiCompleteRegistration({
              fbclid: rBody.fbclid,
              fbclidTs: rBody.fbclidTs,
              landingUrl: rBody.landingUrl,
              capiToken: env.META_CAPI_TOKEN,
              pixelId: env.META_PIXEL_ID,
              request: request as unknown as Request,
            })
          );
        }
      }
      return new Response(JSON.stringify({ type: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://vibes.diy" },
      }) as unknown as CFResponse;
    }

    if (route === "clerk-webhook") {
      if (env.CLERK_WEBHOOK_SECRET === undefined) {
        return new Response(JSON.stringify({ type: "error", message: "not configured" }), { status: 503 }) as unknown as CFResponse;
      }
      const body = await request.text();
      const svixId = request.headers.get("svix-id") ?? "";
      const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
      const svixSignature = request.headers.get("svix-signature") ?? "";
      const rEvt = await verifyClerkWebhookSignature({
        body,
        svixId,
        svixTimestamp,
        svixSignature,
        secret: env.CLERK_WEBHOOK_SECRET,
      });
      if (rEvt.isErr()) {
        console.error("[clerk-webhook] verification failed:", rEvt.Err().message);
        return new Response(JSON.stringify({ type: "error", message: "invalid signature" }), {
          status: 401,
        }) as unknown as CFResponse;
      }
      const evt = rEvt.Ok() as { type?: string; data?: ClerkUserCreatedData };
      if (evt.type === "user.created" && evt.data !== undefined && env.DISCORD_WEBHOOK_URL !== undefined) {
        ctx.waitUntil(postSignupToDiscord(env.DISCORD_WEBHOOK_URL, evt.data));
      }
      return new Response(JSON.stringify({ type: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }) as unknown as CFResponse;
    }

    const cctx = ctx as unknown as ExecutionContext & CFInjectMutable;
    cctx.cache = caches.default as unknown as CfCacheIf;
    const cfCtx = await cfServeAppCtx(request, env, cctx);
    cctx.appCtx = cfCtx.appCtx;

    if (route === "cf-serve") {
      const res = await cfServe(request, cctx);
      if (url.pathname !== "/assets") {
        caches.default.put(request.url, res.clone() as unknown as CFResponse);
      }
      return res;
    }

    if (route === "reports-asset") {
      return env.ASSETS.fetch(request);
    }

    if (route === "reports-config") {
      const body = JSON.stringify({
        type: "vibes.diy.reports-config",
        clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY,
      });
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
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
          console.log("[referer]", referer, request.method, rReqUri.Ok().pathname);
        }
      }
    }

    // For /vibe/:userSlug/:appSlug routes, look up the real app title so SSR
    // can embed it in OG/Twitter meta tags before the page reaches crawlers.
    const vibeSlugPair = parseVibePathname(url.pathname);
    const vibeHints =
      vibeSlugPair !== undefined
        ? await getVibeRouteHints(cfCtx.vibesCtx, vibeSlugPair).then((r) =>
            r.isOk() ? r.Ok() : { ogTitle: undefined, isWorldReadable: false }
          )
        : { ogTitle: undefined, isWorldReadable: false };

    // Suppress the fast-paint optimisation for explicit-fsId URLs
    // (/vibe/:userSlug/:appSlug/:fsId). getVibeRouteHints queries the latest
    // production row, but the iframe will serve the requested fsId which may be
    // a dev/draft build whose grant check won't confirm public access.
    const hasFsId = vibePathnameHasFsId(url.pathname);

    // Delegate to React Router for SSR
    const ssrResponse = (await getRequestHandler()(request as unknown as Parameters<ReturnType<typeof createRequestHandler>>[0], {
      vibeDiyAppParams: cfCtx.vibesCtx.params,
      vibeOgTitle: vibeHints.ogTitle,
      isWorldReadable: hasFsId ? false : vibeHints.isWorldReadable,
    })) as unknown as CFResponse;

    // Log missing vibe paths so the ETL pipeline can surface them for reanimation triage.
    // Only log /vibe/<user>/<slug> (and deeper) paths — the two-segment legacy form is
    // already handled by the 301 redirect above and never reaches SSR.
    if (ssrResponse.status === 404 && vibeSlugPair !== undefined) {
      console.log("[missing-vibe]", url.pathname);
    }

    return ssrResponse;
  },
} satisfies ExportedHandler<CFEnv>;
