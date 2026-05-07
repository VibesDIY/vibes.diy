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
import {
  HttpResponseBodyType,
  HttpResponseJsonType,
  isFetchErrResult,
  isFetchNotFoundResult,
  isFetchOkResult,
} from "@vibes.diy/api-types";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { VibesApiSQLCtx } from "../types.js";
import { verifyAuth } from "../check-auth.js";
import { checkDocAccess } from "./access-helpers.js";
import { aclAllows, resolveDbAcl } from "./db-acl-resolver.js";

interface CidAssetValidated {
  readonly url: string;
  readonly mime: string;
  // ACL gate: when ALL three are present we authenticate the request and
  // require the user to have read access on (userSlug, appSlug, dbName) per
  // the per-db ACL system. When any of the three is absent the request is
  // served public-by-CID, preserving existing icon / app-code semantics and
  // the CLI's `--verify-fetch` flow.
  readonly userSlug?: string;
  readonly appSlug?: string;
  readonly dbName?: string;
  readonly bearer?: string;
}

function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : undefined;
}

// Bearer headers carry no type marker, so we probe each registered tokenApi
// type until one verifies. JWT verification is cheap; with two registered
// types (clerk, device-id) the worst case is two signature checks.
async function verifyAnyBearer(vctx: VibesApiSQLCtx, token: string): Promise<string | undefined> {
  for (const type of Object.keys(vctx.tokenApi)) {
    const rAuth = await verifyAuth(vctx, { auth: { type, token } as DashAuthType });
    if (rAuth.isOk() && rAuth.Ok().type === "VerifiedAuthResult") {
      return rAuth.Ok().verifiedAuth.claims.userId;
    }
  }
  return undefined;
}

export const cidAsset: EventoHandler<Request, CidAssetValidated, unknown> = {
  hash: "cid-asset",
  validate: (ctx: ValidateTriggerCtx<Request, CidAssetValidated, unknown>) => {
    const { request: req } = ctx;
    if (!req) return Promise.resolve(Result.Ok(Option.None()));
    if (req.method !== "GET" && req.method !== "HEAD") {
      return Promise.resolve(Result.Ok(Option.None()));
    }
    const url = URI.from(req.url);
    if (!url.pathname.startsWith("/assets/cid") || !url.getParam("url")) {
      return Promise.resolve(Result.Ok(Option.None()));
    }
    return Promise.resolve(
      Result.Ok(
        Option.Some({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          url: url.getParam("url")!,
          mime: url.getParam("mime") || "application/octet-stream",
          userSlug: url.getParam("user"),
          appSlug: url.getParam("app"),
          dbName: url.getParam("db"),
          bearer: extractBearer(req),
        })
      )
    );
  },
  handle: async (ctx: HandleTriggerCtx<Request, CidAssetValidated, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { url, mime, userSlug, appSlug, dbName, bearer } = ctx.validated;

    // ACL gate engages only when all three identifiers are present. Any
    // partial set is treated as a malformed gated request rather than a
    // silent fall-through to public — better to fail loudly than to leak
    // bytes if a caller forgets one of the three.
    const gated = userSlug !== undefined || appSlug !== undefined || dbName !== undefined;
    if (gated) {
      if (!userSlug || !appSlug || !dbName) {
        ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 400,
          json: { type: "error", message: "user, app, and db must be provided together" },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Stop);
      }
      if (!bearer) {
        ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 401,
          json: { type: "error", message: "Authentication required" },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Stop);
      }
      const userId = await verifyAnyBearer(vctx, bearer);
      if (!userId) {
        ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 401,
          json: { type: "error", message: "Invalid or expired token" },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Stop);
      }
      const access = await checkDocAccess(vctx, userId, appSlug, userSlug);
      const rAcl = await resolveDbAcl(vctx, userSlug, appSlug, dbName);
      // Fail closed on ACL resolution error: a settings-read failure must
      // not silently fall back to the open default and re-open reads on a
      // tightened ACL.
      if (rAcl.isErr() || !aclAllows(rAcl.Ok(), "read", access)) {
        ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 403,
          json: { type: "error", message: "Access denied" },
        } satisfies HttpResponseJsonType);
        return Result.Ok(EventoResult.Stop);
      }
    }

    const rAsset = await vctx.storage.fetch(url);
    switch (true) {
      case isFetchErrResult(rAsset):
        ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 500,
          json: { type: "error", message: rAsset.error.message },
        } satisfies HttpResponseJsonType);
        break;
      case isFetchNotFoundResult(rAsset):
        ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 404,
          json: { type: "error", message: `Asset not found for URL ${url}` },
        } satisfies HttpResponseJsonType);
        break;
      case isFetchOkResult(rAsset):
        ctx.send.send(ctx, {
          type: "http.Response.Body",
          status: 200,
          headers: {
            "Content-Type": mime,
            "Cache-Control": gated ? "private, max-age=31536000, immutable" : "public, max-age=31536000, immutable",
          },
          body: rAsset.data,
        } satisfies HttpResponseBodyType);
        break;
      default:
        ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 500,
          json: { type: "error", message: `Unexpected fetch result type for URL ${url}` },
        } satisfies HttpResponseJsonType);
    }
    return Result.Ok(EventoResult.Stop);
  },
};
