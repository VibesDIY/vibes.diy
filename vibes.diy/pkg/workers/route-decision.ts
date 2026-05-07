// Routing decision for the top-level Worker fetch handler.
//
// Pure function — no I/O, no env lookup beyond what the caller passes —
// so the rules can be unit-tested without spinning up miniflare. The
// actual `app.ts` fetch handler delegates to this so the routing
// invariant is exercised at test time and not just in production.

export type Route =
  | "api-do" // /api/* → ChatSessions DO (WebSocket + DocNotify)
  | "vibe-pkg" // /vibe-pkg/* → npm package serving
  | "cf-serve" // app subdomain *--*.host, /assets/cid, POST/OPTIONS /assets
  | "static-asset" // /assets/* (Vite hashed) — must NOT swallow /assets root
  | "ssr"; // everything else → React Router

export interface RouteInput {
  readonly hostname: string;
  readonly pathname: string;
  readonly method: string;
  readonly hostnameBase: string;
}

export function routeDecision(req: RouteInput): Route {
  const { hostname, pathname, method, hostnameBase } = req;

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "api-do";
  }
  if (pathname.startsWith("/vibe-pkg/")) {
    return "vibe-pkg";
  }

  // App subdomain: hostname is `<app>--<user>.<base>`.
  const isAppSubdomain = hostname.endsWith(hostnameBase) && hostname.slice(0, -hostnameBase.length).includes("--");

  // /assets/cid is the read-side handler (any method, including HEAD).
  // POST /assets (and OPTIONS preflight) is the put-asset write endpoint.
  // Both live at host root because /api/* goes to the DO.
  const isAssetsCid = pathname.startsWith("/assets/cid");
  const isPutAsset = pathname === "/assets" && (method === "POST" || method === "OPTIONS");

  if (isAppSubdomain || isAssetsCid || isPutAsset) {
    return "cf-serve";
  }

  // /assets/* (other than /assets/cid) is the Vite hashed-asset bucket.
  // /assets exactly (GET/HEAD) is not a real route — falls through to SSR.
  if (pathname.startsWith("/assets/") && !isAssetsCid) {
    return "static-asset";
  }

  return "ssr";
}
