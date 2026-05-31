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
import { HttpResponseBodyType, HttpResponseJsonType, isUserSettingProfile } from "@vibes.diy/api-types";
import { eq } from "drizzle-orm";
import { VibesApiSQLCtx } from "../types.js";

export interface AvatarHttpResult {
  status: 200 | 302 | 304 | 404;
  headers: Record<string, string>;
  body?: string;
}

// Spec §1a — content-addressed URL behind a stable per-ownerHandle
// indirection so embedded references update when the user uploads a
// new avatar.
export async function handleGetUserAvatar(
  vctx: VibesApiSQLCtx,
  ownerHandle: string,
  ifNoneMatch: string | undefined
): Promise<AvatarHttpResult> {
  const binding = await vctx.sql.db
    .select({ userId: vctx.sql.tables.handleBinding.userId })
    .from(vctx.sql.tables.handleBinding)
    .where(eq(vctx.sql.tables.handleBinding.handle, ownerHandle))
    .limit(1)
    .then((r) => r[0]);
  if (!binding) return { status: 404, headers: {} };

  const settingsRow = await vctx.sql.db
    .select({ settings: vctx.sql.tables.userSettings.settings })
    .from(vctx.sql.tables.userSettings)
    .where(eq(vctx.sql.tables.userSettings.userId, binding.userId))
    .limit(1)
    .then((r) => r[0]);

  let avatarCid: string | undefined;
  for (const item of (settingsRow?.settings as unknown[]) ?? []) {
    if (isUserSettingProfile(item) && item.avatarCid) {
      avatarCid = item.avatarCid;
      break;
    }
  }
  if (!avatarCid) return { status: 404, headers: {} };

  const etag = `"${avatarCid}"`;
  if (ifNoneMatch === etag) {
    return {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "max-age=0, must-revalidate",
      },
    };
  }

  // Resolve the bare CID to the stored assetURI so we can proxy via the
  // existing cid-asset endpoint (/assets/cid/?url=...&mime=...).
  // The AssetUploads audit table is the only way to recover assetURI from
  // a bare CID without peer-probing — see put-asset.ts for the rationale.
  const uploadsT = vctx.sql.tables.assetUploads;
  const upload = await vctx.sql.db
    .select({ assetURI: uploadsT.assetURI, mimeType: uploadsT.mimeType })
    .from(uploadsT)
    .where(eq(uploadsT.cid, avatarCid))
    .limit(1)
    .then((r) => r[0]);

  if (!upload) return { status: 404, headers: {} };

  const mime = upload.mimeType ?? "application/octet-stream";
  const target = `/assets/cid/?url=${encodeURIComponent(upload.assetURI)}&mime=${encodeURIComponent(mime)}`;

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
