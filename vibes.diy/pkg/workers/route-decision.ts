// Routing decision for the top-level Worker fetch handler.
//
// Pure function — no I/O, no env lookup beyond what the caller passes —
// so the rules can be unit-tested without spinning up miniflare. The
// actual `app.ts` fetch handler delegates to this so the routing
// invariant is exercised at test time and not just in production.

import { ShardKind } from "@vibes.diy/api-types";

export type Route =
  | "app-api" // /api/app → AppSessions DO (vibe-scoped WebSocket)
  | "shared-do" // /api/shared → SharedSessions DO (singleton/per-user shared-plane WS)
  | "api-do" // /api/* → ChatSessions DO (WebSocket)
  | "backend-api" // /_api/* (app subdomain) or /vibe/{o}/{s}/_api/* → BackendDO (per-vibe backend.js, #2856 B3)
  | "vibe-pkg" // /vibe-pkg/* → npm package serving
  | "cf-serve" // app subdomain *--*.host, /assets/cid, POST/OPTIONS /assets
  | "reports-config" // /reports/config.json → JSON of public env (Clerk pub key)
  | "reports-asset" // /reports/* (everything else) → standalone SPA in build/client/reports/
  | "static-asset" // /assets/* (Vite hashed) — must NOT swallow /assets root
  | "capi-relay" // POST|OPTIONS /capi/engaged → Meta CAPI EngagedVisit relay
  | "capi-complete-registration" // POST|OPTIONS /capi/complete-registration → Meta CAPI CompleteRegistration relay
  | "clerk-webhook" // POST /webhooks/clerk → Svix-verified Clerk event handler
  | "legacy-vibe-redirect" // /vibe/<slug> (exactly two segments) → 301 to /vibe/og/<slug>
  | "vibe-trailing-slash-redirect" // /vibe/<…>/ (trailing slash) → 301 to the slash-stripped path
  | "ssr"; // everything else → React Router

export interface RouteInput {
  readonly hostname: string;
  readonly pathname: string;
  readonly method: string;
  readonly hostnameBase: string;
}

export function routeDecision(req: RouteInput): Route {
  const { hostname, pathname, method, hostnameBase } = req;

  if (pathname === "/api/app" || pathname.startsWith("/api/app/")) {
    return "app-api";
  }
  if (pathname === "/api/shared" || pathname.startsWith("/api/shared/")) {
    return "shared-do";
  }
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "api-do";
  }
  if (pathname.startsWith("/vibe-pkg/")) {
    return "vibe-pkg";
  }

  // App subdomain: hostname is `<app>--<user>.<base>`.
  const isAppSubdomain = hostname.endsWith(hostnameBase) && hostname.slice(0, -hostnameBase.length).includes("--");

  // Per-app `backend.js` `_api` route (#2856 B3). The reserved `_api` prefix
  // reaches a vibe by two request forms; both must be decided BEFORE the
  // `cf-serve` (app-subdomain) and `/vibe/*` SSR/redirect branches below, or the
  // request gets served as a static app file / 404 instead of reaching BackendDO.
  // `routeDecision` only classifies; `app.ts` extracts (owner, slug) from the host
  // or path. The `_api` token is underscore-prefixed so it can't collide with an
  // app's own `/api/...` client routes.
  const isBackendApiPath = pathname === "/_api" || pathname.startsWith("/_api/");
  // (1) Published / runtime host: `<slug>--<owner>.<base>/_api/...` (webhooks, iframe `fetch('/_api/…')`).
  if (isAppSubdomain && isBackendApiPath) {
    return "backend-api";
  }
  // (2) Viewer URL: `<base>/vibe/{owner}/{slug}/_api/...` (logged-in viewer).
  if (/^\/vibe\/[^/]+\/[^/]+\/_api(?:\/.*)?$/.test(pathname)) {
    return "backend-api";
  }

  // Asset host: hostname is `assets.<base>`. Singleton per env. Carries
  // the /_files/<u>/<a>/<db>/<doc>/<key> read endpoint and the
  // /_auth/session + /_auth/logout cookie-bridge endpoints.
  const isAssetsHost = hostname.endsWith(hostnameBase) && hostname.slice(0, -hostnameBase.length).replace(/\.$/, "") === "assets";

  // /assets/cid is the read-side handler (any method, including HEAD).
  // POST /assets (and OPTIONS preflight) is the put-asset write endpoint.
  // Both live at host root because /api/* goes to the DO.
  const isAssetsCid = pathname.startsWith("/assets/cid");
  const isPutAsset = pathname === "/assets" && (method === "POST" || method === "OPTIONS");
  // /u/<ownerHandle>/avatar is the stable per-user avatar indirection, served
  // by the userAvatar handler in vibesReqResEvento. Without this entry the
  // path falls through to SSR and the SPA's catch-all returns a 200 HTML
  // "Page Not Found" page, so every <img src="/u/{slug}/avatar"> 404s.
  const isUserAvatar = (method === "GET" || method === "HEAD") && /^\/u\/[^/]+\/avatar$/.test(pathname);

  if (isAppSubdomain || isAssetsHost || isAssetsCid || isPutAsset || isUserAvatar) {
    return "cf-serve";
  }

  // /assets/* (other than /assets/cid) is the Vite hashed-asset bucket.
  // /assets exactly (GET/HEAD) is not a real route — falls through to SSR.
  if (pathname.startsWith("/assets/") && !isAssetsCid) {
    return "static-asset";
  }

  // Growth-reports SPA. /reports/config.json is a tiny worker endpoint that
  // exposes the Clerk publishable key to a static bundle; everything else
  // under /reports/* (including /reports itself) is served from the
  // independently-built bundle in build/client/reports/.
  if (pathname === "/reports/config.json") {
    return "reports-config";
  }
  if (pathname === "/reports" || pathname.startsWith("/reports/")) {
    return "reports-asset";
  }

  if (pathname === "/capi/engaged" && (method === "POST" || method === "OPTIONS")) {
    return "capi-relay";
  }

  if (pathname === "/capi/complete-registration" && (method === "POST" || method === "OPTIONS")) {
    return "capi-complete-registration";
  }

  if (pathname === "/webhooks/clerk" && method === "POST") {
    return "clerk-webhook";
  }

  // Canonical vibe URLs carry no trailing slash (#1428). Any /vibe/<…>/ form
  // (e.g. the published /vibe/<user>/<slug>/ that older Share modals emitted)
  // 301s to the slash-stripped path so copied links, canonical tags, and
  // redirects all converge on one convention. `/vibe/` alone is left to fall
  // through — there is nothing to strip to.
  if (/^\/vibe\/.+\/$/.test(pathname)) {
    return "vibe-trailing-slash-redirect";
  }

  // /vibe/prompt is the new-build entry (mints a slug then redirects to the real
  // vibe — the homepage's first-build path, #2876). It looks like a single-segment
  // legacy vibe slug but is NOT one: a document load of /vibe/prompt?prompt64=…
  // (OAuth fallback, refresh, copied URL) must reach React Router and render
  // ChatPrompt, not 301 to /vibe/og/prompt. Exempt it before the legacy rule.
  if (pathname === "/vibe/prompt") {
    return "ssr";
  }

  // Legacy two-segment vibe paths: /vibe/<slug> → redirect to /vibe/og/<slug>.
  // Must not match /vibe/og/… (three segments) or any deeper path.
  if (/^\/vibe\/[^/]+$/.test(pathname)) {
    return "legacy-vibe-redirect";
  }

  return "ssr";
}

// #2714 Spec B — the unified `Sessions` DO can't infer its plane from its class
// (there's only one class now), so it derives the shard kind from the request
// path. These branches MUST mirror the `app-api`/`shared-do`/`api-do` cases in
// `routeDecision` above (a parity test pins them together): app.ts routes by
// `routeDecision`, the DO stamps its identity by `shardKindForPath` — both keyed
// on the same pathname, so they can't disagree.
export function shardKindForPath(pathname: string): ShardKind {
  if (pathname === "/api/app" || pathname.startsWith("/api/app/")) return "vibe";
  if (pathname === "/api/shared" || pathname.startsWith("/api/shared/")) return "shared";
  return "codegen"; // "/api" or "/api/*" (the api-do route)
}

// ── backend.js `_api` target extraction (#2856 B3) ────────────────────────────

export interface BackendApiTarget {
  readonly ownerHandle: string;
  readonly appSlug: string;
  /** The handler-relative path: `…/_api/webhooks/x` → `/webhooks/x`; bare `_api` → `/`. */
  readonly backendPath: string;
}

// Mirrors `extractHostToBindings`'s host regex (api/pkg): appSlug is the first
// label, ownerHandle the second, split on the FIRST `--`, both lowercased — so the
// backend and the page resolve the same vibe from the same subdomain.
const APP_SUBDOMAIN_RE = /^([a-zA-Z0-9][a-zA-Z0-9-]*?)--([a-zA-Z0-9][a-zA-Z0-9-]+)/;
const VIEWER_API_RE = /^\/vibe\/([^/]+)\/([^/]+)\/_api(\/.*)?$/;

/**
 * Resolve `(ownerHandle, appSlug)` + the handler-relative path for a `backend-api`
 * request, from either request form (#2856 B3). Returns `undefined` if neither
 * matches (the caller 404s). Pairs with `routeDecision` returning `"backend-api"`.
 */
export function parseBackendApiTarget(req: RouteInput): BackendApiTarget | undefined {
  const { hostname, pathname, hostnameBase } = req;

  // Viewer URL: /vibe/{owner}/{slug}/_api(/rest)?
  const viewer = VIEWER_API_RE.exec(pathname);
  if (viewer) {
    return { ownerHandle: viewer[1].toLowerCase(), appSlug: viewer[2].toLowerCase(), backendPath: viewer[3] || "/" };
  }

  // App subdomain: <slug>--<owner>.<base>, path /_api(/rest)?
  const isAppSubdomain = hostname.endsWith(hostnameBase) && hostname.slice(0, -hostnameBase.length).includes("--");
  if (isAppSubdomain && (pathname === "/_api" || pathname.startsWith("/_api/"))) {
    const label = hostname.slice(0, -hostnameBase.length).replace(/\.$/, "");
    const m = APP_SUBDOMAIN_RE.exec(label);
    if (!m) return undefined;
    const rest = pathname.slice("/_api".length);
    return { ownerHandle: m[2].toLowerCase(), appSlug: m[1].toLowerCase(), backendPath: rest || "/" };
  }

  return undefined;
}
