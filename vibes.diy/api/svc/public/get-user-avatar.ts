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
import { HttpResponseBodyType, HttpResponseJsonType } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { readHandleAvatar } from "./handle-settings.js";

export interface AvatarHttpResult {
  status: 200 | 302 | 304 | 404;
  headers: Record<string, string>;
  body?: string;
}

// Per-handle avatar (spec: docs/superpowers/specs/2026-06-18-per-handle-avatar-design.md).
// `/u/<handle>/avatar` is a stable indirection; it resolves the handle's OWN
// `active.avatar` from HandleSettings and 302s to the content-addressed bytes.
//
// PRIVACY INVARIANT: there is NO fallback to a user-level avatar. A handle with
// no avatar of its own returns 404 (the client renders initials) — serving a
// shared account avatar would render byte-identical images for two handles of
// the same user and correlate the personas.
//
// `active.avatar.currentCid` holds the storage getURL (app-icon convention), so
// resolution is a direct redirect with no assetUploads lookup. The ETag is keyed
// on that identity; a new upload changes it and busts the cache.
export async function handleGetUserAvatar(
  vctx: VibesApiSQLCtx,
  ownerHandle: string,
  ifNoneMatch: string | undefined
): Promise<AvatarHttpResult> {
  const avatar = await readHandleAvatar(vctx, ownerHandle);
  if (!avatar) return { status: 404, headers: {} };

  const etag = `"${avatar.getURL}"`;
  if (ifNoneMatch === etag) {
    return {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "max-age=0, must-revalidate",
      },
    };
  }

  const target = `/assets/cid/?url=${encodeURIComponent(avatar.getURL)}&mime=${encodeURIComponent(avatar.mime)}`;
  return {
    status: 302,
    headers: {
      Location: target,
      ETag: etag,
      "Cache-Control": "max-age=0, must-revalidate",
    },
  };
}

// USER_AVATAR_PATH_RE matches GET /u/<ownerHandle>/avatar where ownerHandle is the
// path segment between /u/ and /avatar.
const USER_AVATAR_PATH_RE = /^\/u\/([^/]+)\/avatar$/;

// Evento handler that wires GET /u/:ownerHandle/avatar into the HTTP evento chain.
// Registered after cidAsset so content-addressed asset fetches are handled
// before the stable-redirect layer.
export const userAvatar: EventoHandler<Request, { ownerHandle: string; ifNoneMatch: string | undefined }, unknown> = {
  hash: "user-avatar",
  validate: (ctx: ValidateTriggerCtx<Request, { ownerHandle: string; ifNoneMatch: string | undefined }, unknown>) => {
    const { request: req } = ctx;
    if (req && (req.method === "GET" || req.method === "HEAD")) {
      const url = URI.from(req.url);
      const m = USER_AVATAR_PATH_RE.exec(url.pathname);
      if (m) {
        return Promise.resolve(
          Result.Ok(
            Option.Some({
              ownerHandle: decodeURIComponent(m[1]),
              ifNoneMatch: req.headers.get("If-None-Match") ?? undefined,
            })
          )
        );
      }
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<Request, { ownerHandle: string; ifNoneMatch: string | undefined }, unknown>
  ): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { ownerHandle, ifNoneMatch } = ctx.validated;

    const res = await handleGetUserAvatar(vctx, ownerHandle, ifNoneMatch);

    if (res.status === 404) {
      await ctx.send.send(ctx, {
        type: "http.Response.JSON",
        status: 404,
        json: { type: "error", message: `Avatar not found for user ${ownerHandle}` },
      } satisfies HttpResponseJsonType);
      return Result.Ok(EventoResult.Stop);
    }

    // 304 and 302 both use the Body type with a null body
    await ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: res.status,
      headers: res.headers,
      body: null,
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  },
};
