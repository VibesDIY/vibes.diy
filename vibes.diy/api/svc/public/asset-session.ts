import {
  EventoHandler,
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  EventoResultType,
  Option,
  EventoResult,
  URI,
} from "@adviser/cement";
import { HttpResponseBodyType } from "@vibes.diy/api-types";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { VibesApiSQLCtx } from "../types.js";
import { verifyAuth } from "../check-auth.js";

// Auth bridge endpoints on the asset host. The parent shell at vibes.diy
// posts the user's Clerk Bearer token here once at iframe boot; the server
// mints a short-lived host-only HttpOnly cookie that browsers will then
// auto-attach to every subresource fetch (`<img src=...>`, `<video>`, etc.)
// to the asset host. The cookie carries verified userId only — per-db ACL
// still gates `(userSlug, appSlug, dbName)` at /_files/<...> read time.
//
// The endpoints sit on the asset host (`assets.<env>.vibesdiy.net`), not
// on vibes.diy or the per-vibe subdomain. SameSite=None + Partitioned is
// required because the top-level browsing context (vibes.diy) and the
// asset host live on different eTLD+1's. Partitioned (CHIPS) restricts
// the cookie to the vibes.diy partition so any future third-party embed
// gets a separate partition and fails closed.
//
// TTL is bounded by min(claims.exp - now - 10s, 3600). The cookie is a
// stateless JWT — no server-side revocation — so suspend / role drop
// takes effect within TTL. Sign-out is the client clearing the cookie
// via /_auth/logout.

const COOKIE_NAME = "vibes-asset-session";
const MAX_TTL_SEC = 3600;
const SAFETY_MARGIN_SEC = 10;
const COOKIE_FLAGS = "HttpOnly; Secure; SameSite=None; Partitioned; Path=/";

interface AuthSessionValidated {
  readonly bearer: string;
  readonly origin: string;
}

interface AuthLogoutValidated {
  readonly origin: string;
}

function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : undefined;
}

// Bearer headers carry no type marker, so probe each registered tokenApi
// type until one verifies. JWT verification is cheap; with two registered
// types (clerk, device-id) the worst case is two signature checks.
async function verifyAnyBearer(vctx: VibesApiSQLCtx, token: string): Promise<{ userId: string; exp: number } | undefined> {
  for (const type of Object.keys(vctx.tokenApi)) {
    const rAuth = await verifyAuth(vctx, { auth: { type, token } as DashAuthType });
    if (rAuth.isOk() && rAuth.Ok().type === "VerifiedAuthResult") {
      const claims = rAuth.Ok().verifiedAuth.claims as { userId: string; exp?: number };
      const exp = typeof claims.exp === "number" ? claims.exp : Math.floor(Date.now() / 1000) + MAX_TTL_SEC;
      return { userId: claims.userId, exp };
    }
  }
  return undefined;
}

export const authSession: EventoHandler<Request, AuthSessionValidated, unknown> = {
  hash: "auth-session",
  validate: (ctx: ValidateTriggerCtx<Request, AuthSessionValidated, unknown>) => {
    const { request: req } = ctx;
    if (!req || req.method !== "POST") return Promise.resolve(Result.Ok(Option.None()));
    const url = URI.from(req.url);
    if (url.pathname !== "/_auth/session") return Promise.resolve(Result.Ok(Option.None()));
    const bearer = extractBearer(req);
    const origin = req.headers.get("Origin") ?? req.headers.get("origin") ?? "";
    return Promise.resolve(Result.Ok(Option.Some({ bearer: bearer ?? "", origin })));
  },
  handle: async (ctx: HandleTriggerCtx<Request, AuthSessionValidated, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { bearer, origin } = ctx.validated;
    if (!bearer) {
      return sendErr(ctx, 401, "missing Authorization Bearer token", origin);
    }
    const verified = await verifyAnyBearer(vctx, bearer);
    if (!verified) {
      return sendErr(ctx, 401, "invalid bearer token", origin);
    }
    const now = Math.floor(Date.now() / 1000);
    const ttlFromClaims = verified.exp - now - SAFETY_MARGIN_SEC;
    const ttlSec = Math.max(1, Math.min(MAX_TTL_SEC, ttlFromClaims));
    const rSigned = await vctx.assetSessionSigner.sign({ userId: verified.userId }, ttlSec);
    if (rSigned.isErr()) {
      return sendErr(ctx, 500, `cookie sign failed: ${rSigned.Err().message}`, origin);
    }
    const { token } = rSigned.Ok();
    const setCookie = `${COOKIE_NAME}=${token}; ${COOKIE_FLAGS}; Max-Age=${ttlSec}`;
    await ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      body: JSON.stringify({ type: "vibes.diy.res-auth-session", maxAge: ttlSec }),
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookie,
        ...credentialedCorsHeaders(origin),
      },
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  },
};

// Credentialed-CORS preflight for the bridge endpoints. The wildcard
// `cors-preflight` handler returns ACAO: * which the browser refuses on
// credentialed requests; we have to reflect the Origin and set
// Access-Control-Allow-Credentials: true so the POST that follows can
// carry/receive cookies. Authorization header must be in Allow-Headers
// (the parent posts the Bearer there).
export const authBridgePreflight: EventoHandler<Request, { origin: string }, unknown> = {
  hash: "auth-bridge-preflight",
  validate: (ctx: ValidateTriggerCtx<Request, { origin: string }, unknown>) => {
    const { request: req } = ctx;
    if (!req || req.method !== "OPTIONS") return Promise.resolve(Result.Ok(Option.None()));
    const url = URI.from(req.url);
    if (url.pathname !== "/_auth/session" && url.pathname !== "/_auth/logout") {
      return Promise.resolve(Result.Ok(Option.None()));
    }
    const origin = req.headers.get("Origin") ?? req.headers.get("origin") ?? "";
    return Promise.resolve(Result.Ok(Option.Some({ origin })));
  },
  handle: async (ctx: HandleTriggerCtx<Request, { origin: string }, unknown>): Promise<Result<EventoResultType>> => {
    const { origin } = ctx.validated;
    await ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      body: "",
      headers: {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
        "Access-Control-Allow-Headers": "Origin, Content-Type, Accept, Authorization",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      },
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  },
};

function credentialedCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

export const authLogout: EventoHandler<Request, AuthLogoutValidated, unknown> = {
  hash: "auth-logout",
  validate: (ctx: ValidateTriggerCtx<Request, AuthLogoutValidated, unknown>) => {
    const { request: req } = ctx;
    if (!req || req.method !== "POST") return Promise.resolve(Result.Ok(Option.None()));
    const url = URI.from(req.url);
    if (url.pathname !== "/_auth/logout") return Promise.resolve(Result.Ok(Option.None()));
    const origin = req.headers.get("Origin") ?? req.headers.get("origin") ?? "";
    return Promise.resolve(Result.Ok(Option.Some({ origin })));
  },
  handle: async (ctx: HandleTriggerCtx<Request, AuthLogoutValidated, unknown>): Promise<Result<EventoResultType>> => {
    const { origin } = ctx.validated;
    const setCookie = `${COOKIE_NAME}=; ${COOKIE_FLAGS}; Max-Age=0`;
    await ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      body: JSON.stringify({ type: "vibes.diy.res-auth-logout" }),
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": setCookie,
        ...credentialedCorsHeaders(origin),
      },
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  },
};

function sendErr(
  ctx: HandleTriggerCtx<Request, unknown, unknown>,
  status: number,
  message: string,
  origin: string
): Result<EventoResultType> {
  ctx.send.send(ctx, {
    type: "http.Response.Body",
    status,
    body: JSON.stringify({ type: "error", message }),
    headers: {
      "Content-Type": "application/json",
      ...credentialedCorsHeaders(origin),
    },
  } satisfies HttpResponseBodyType);
  return Result.Ok(EventoResult.Stop);
}

export const ASSET_SESSION_COOKIE_NAME = COOKIE_NAME;
