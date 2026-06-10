// Routing decision for the top-level Worker fetch handler.
//
// Pure function — no I/O, no env lookup beyond what the caller passes —
// so the rules can be unit-tested without spinning up miniflare. The
// actual `app.ts` fetch handler delegates to this so the routing
// invariant is exercised at test time and not just in production.

export type Route =
  | "app-api" // /api/app → AppSessions DO (vibe-scoped WebSocket)
  | "api-do" // /api/* → ChatSessions DO (WebSocket)
  | "vibe-pkg" // /vibe-pkg/* → npm package serving
  | "cf-serve" // app subdomain *--*.host, /assets/cid, POST/OPTIONS /assets
  | "reports-config" // /reports/config.json → JSON of public env (Clerk pub key)
  | "reports-asset" // /reports/* (everything else) → standalone SPA in build/client/reports/
  | "static-asset" // /assets/* (Vite hashed) — must NOT swallow /assets root
  | "capi-relay" // POST|OPTIONS /capi/engaged → Meta CAPI EngagedVisit relay
  | "capi-complete-registration" // POST|OPTIONS /capi/complete-registration → Meta CAPI CompleteRegistration relay
  | "clerk-webhook" // POST /webhooks/clerk → Svix-verified Clerk event handler
  | "legacy-vibe-redirect" // /vibe/<slug> (exactly two segments) → 301 to /vibe/og/<slug>
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
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "api-do";
  }
  if (pathname.startsWith("/vibe-pkg/")) {
    return "vibe-pkg";
  }

  // App subdomain: hostname is `<app>--<user>.<base>`.
  const isAppSubdomain = hostname.endsWith(hostnameBase) && hostname.slice(0, -hostnameBase.length).includes("--");

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

  // Legacy two-segment vibe paths: /vibe/<slug> → redirect to /vibe/og/<slug>.
  // Must not match /vibe/og/… (three segments) or any deeper path.
  if (/^\/vibe\/[^/]+$/.test(pathname)) {
    return "legacy-vibe-redirect";
  }

  return "ssr";
}
