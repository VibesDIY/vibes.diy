import { describe, expect, it } from "vitest";
import { routeDecision } from "../../pkg/workers/route-decision.js";

const HOSTNAME_BASE = "vibesdiy.net";

function decide(opts: { pathname: string; method?: string; hostname?: string }) {
  return routeDecision({
    hostname: opts.hostname ?? "vibes.diy",
    pathname: opts.pathname,
    method: opts.method ?? "GET",
    hostnameBase: HOSTNAME_BASE,
  });
}

describe("worker routeDecision", () => {
  it("/api/* → ChatSessions DO (WebSocket + DocNotify)", () => {
    expect(decide({ pathname: "/api" })).toBe("api-do");
    expect(decide({ pathname: "/api/" })).toBe("api-do");
    expect(decide({ pathname: "/api/foo/bar" })).toBe("api-do");
  });

  it("/vibe-pkg/* → npm package serving", () => {
    expect(decide({ pathname: "/vibe-pkg/foo" })).toBe("vibe-pkg");
    expect(decide({ pathname: "/vibe-pkg/" })).toBe("vibe-pkg");
  });

  it("app subdomain → cf-serve regardless of method/path", () => {
    expect(decide({ hostname: "myapp--alice.vibesdiy.net", pathname: "/" })).toBe("cf-serve");
    expect(decide({ hostname: "myapp--alice.vibesdiy.net", pathname: "/_files/db/doc/key" })).toBe("cf-serve");
  });

  it("/assets/cid* → cf-serve (read endpoint)", () => {
    expect(decide({ pathname: "/assets/cid?url=foo" })).toBe("cf-serve");
    expect(decide({ pathname: "/assets/cid", method: "HEAD" })).toBe("cf-serve");
  });

  it("POST /assets → cf-serve (put-asset write endpoint)", () => {
    expect(decide({ pathname: "/assets", method: "POST" })).toBe("cf-serve");
  });

  it("OPTIONS /assets → cf-serve (CORS preflight for put-asset)", () => {
    expect(decide({ pathname: "/assets", method: "OPTIONS" })).toBe("cf-serve");
  });

  it("GET /assets (without /cid) → SSR — not the put-asset endpoint", () => {
    expect(decide({ pathname: "/assets", method: "GET" })).toBe("ssr");
  });

  it("/assets/<hash>.js → static-asset (Vite hashed bundles)", () => {
    expect(decide({ pathname: "/assets/index-abc123.js" })).toBe("static-asset");
    expect(decide({ pathname: "/assets/main.css" })).toBe("static-asset");
  });

  it("/assets/cid is NOT mistaken for a static asset", () => {
    expect(decide({ pathname: "/assets/cid" })).toBe("cf-serve");
    expect(decide({ pathname: "/assets/cid/foo" })).toBe("cf-serve");
  });

  it("everything else → SSR (React Router)", () => {
    expect(decide({ pathname: "/" })).toBe("ssr");
    expect(decide({ pathname: "/login" })).toBe("ssr");
    expect(decide({ pathname: "/vibe/alice/myapp" })).toBe("ssr");
  });

  it("regression: /assets POST does NOT route to /api/ (DO would mishandle as DocNotify)", () => {
    // The DO's fetch handler treats every POST as a DocNotify delivery
    // and returns 400 on shape mismatch. Routing /assets POST through
    // /api/ would silently break uploads.
    expect(decide({ pathname: "/assets", method: "POST" })).not.toBe("api-do");
  });

  it("GET /u/<userSlug>/avatar → cf-serve (stable per-user avatar indirection)", () => {
    expect(decide({ pathname: "/u/jchris/avatar" })).toBe("cf-serve");
    expect(decide({ pathname: "/u/jchris/avatar", method: "HEAD" })).toBe("cf-serve");
    // Non-GET methods are not avatar reads — let them fall through to SSR
    // (or 405 from a later layer) so we don't accidentally accept writes here.
    expect(decide({ pathname: "/u/jchris/avatar", method: "POST" })).toBe("ssr");
  });

  it("regression: /u/* paths other than /avatar stay on SSR (vibe pages)", () => {
    // /u/<user>/<app> and friends are React Router routes — must not be
    // hijacked by the avatar opener. Only the literal /avatar suffix wins.
    expect(decide({ pathname: "/u/jchris" })).toBe("ssr");
    expect(decide({ pathname: "/u/jchris/" })).toBe("ssr");
    expect(decide({ pathname: "/u/jchris/myapp" })).toBe("ssr");
    expect(decide({ pathname: "/u/jchris/avatar/extra" })).toBe("ssr");
  });

  it("assets host (assets.<base>) → cf-serve for /_files/* and /_auth/*", () => {
    expect(decide({ hostname: "assets.vibesdiy.net", pathname: "/_files/u/a/db/doc/key" })).toBe("cf-serve");
    expect(decide({ hostname: "assets.vibesdiy.net", pathname: "/_auth/session", method: "POST" })).toBe("cf-serve");
    expect(decide({ hostname: "assets.vibesdiy.net", pathname: "/_auth/logout", method: "POST" })).toBe("cf-serve");
  });

  it("regression: assets-host match must be exact (no smuggled subdomains)", () => {
    // `evilassets.vibesdiy.net` must not match — only the literal
    // `assets.<base>` form. Defends against subdomain-takeover style
    // shenanigans by requiring the segment to be exactly `assets`.
    expect(decide({ hostname: "evilassets.vibesdiy.net", pathname: "/_files/u/a/db/doc/key" })).toBe("ssr");
    expect(decide({ hostname: "assets-evil.vibesdiy.net", pathname: "/_files/u/a/db/doc/key" })).toBe("ssr");
  });

  it("regression: app subdomain match requires '--' separator", () => {
    // Bare TLD-suffix match (e.g. "vibesdiy.net" itself) must not be
    // treated as an app subdomain.
    expect(decide({ hostname: "vibesdiy.net", pathname: "/" })).toBe("ssr");
    expect(decide({ hostname: "www.vibesdiy.net", pathname: "/" })).toBe("ssr");
  });

  it("/reports/config.json → reports-config (worker endpoint, not asset)", () => {
    expect(decide({ pathname: "/reports/config.json" })).toBe("reports-config");
  });

  it("/reports and /reports/* → reports-asset (ASSETS-served SPA)", () => {
    expect(decide({ pathname: "/reports" })).toBe("reports-asset");
    expect(decide({ pathname: "/reports/" })).toBe("reports-asset");
    expect(decide({ pathname: "/reports/index.html" })).toBe("reports-asset");
    expect(decide({ pathname: "/reports/assets/index-abc123.js" })).toBe("reports-asset");
  });

  it("regression: /reports must be matched before SSR fallthrough", () => {
    // A naive impl might leak /reports* into SSR because React Router
    // would 404 on it — but we serve a standalone SPA there.
    expect(decide({ pathname: "/reports/anything" })).not.toBe("ssr");
  });

  it("regression: /reportsfoo (no /) does NOT match /reports", () => {
    // The /reports prefix check uses startsWith("/reports/") not
    // startsWith("/reports"), so unrelated paths like /reportsfoo
    // (if anyone added a route) don't get redirected to the SPA.
    expect(decide({ pathname: "/reportsfoo" })).toBe("ssr");
  });

  it("POST /capi/engaged → capi-relay (CAPI EngagedVisit relay endpoint)", () => {
    expect(decide({ pathname: "/capi/engaged", method: "POST" })).toBe("capi-relay");
  });

  it("OPTIONS /capi/engaged → capi-relay (CORS preflight for relay)", () => {
    expect(decide({ pathname: "/capi/engaged", method: "OPTIONS" })).toBe("capi-relay");
  });

  it("GET /capi/engaged is NOT capi-relay — only POST/OPTIONS", () => {
    expect(decide({ pathname: "/capi/engaged", method: "GET" })).toBe("ssr");
  });

  it("POST /webhooks/clerk → clerk-webhook (Clerk user.created webhook)", () => {
    expect(decide({ pathname: "/webhooks/clerk", method: "POST" })).toBe("clerk-webhook");
  });

  it("GET /webhooks/clerk is NOT clerk-webhook — reject non-POST", () => {
    expect(decide({ pathname: "/webhooks/clerk", method: "GET" })).toBe("ssr");
  });
});

describe("worker routeDecision — PR preview base (pr-<N>.vibespreview.dev)", () => {
  // The PR-preview workflow sets VIBES_SVC_HOSTNAME_BASE = pr-<N>.vibespreview.dev
  // and attaches the matching routes to the PR worker. routeDecision must treat
  // that base exactly like the prod/dev bases — no special-casing needed.
  const BASE = "pr-7.vibespreview.dev";
  const decidePreview = (opts: { pathname: string; method?: string; hostname?: string }) =>
    routeDecision({
      hostname: opts.hostname ?? BASE,
      pathname: opts.pathname,
      method: opts.method ?? "GET",
      hostnameBase: BASE,
    });

  it("<app>--<user>.pr-<N>.vibespreview.dev → cf-serve (vibe iframe entry-point)", () => {
    expect(decidePreview({ hostname: "myapp--alice.pr-7.vibespreview.dev", pathname: "/" })).toBe("cf-serve");
    expect(decidePreview({ hostname: "myapp--alice.pr-7.vibespreview.dev", pathname: "/~zABCDEFGH~/.db-explorer" })).toBe(
      "cf-serve"
    );
  });

  it("pr-<N>.vibespreview.dev/vibe-pkg/* → vibe-pkg (npmUrl host)", () => {
    expect(decidePreview({ pathname: "/vibe-pkg/foo.js" })).toBe("vibe-pkg");
  });

  it("pr-<N>.vibespreview.dev/ → ssr (no app subdomain, no special path)", () => {
    expect(decidePreview({ pathname: "/" })).toBe("ssr");
  });

  it("assets.pr-<N>.vibespreview.dev → cf-serve (asset/auth host)", () => {
    expect(decidePreview({ hostname: "assets.pr-7.vibespreview.dev", pathname: "/_files/u/a/db/doc/key" })).toBe("cf-serve");
  });
});
