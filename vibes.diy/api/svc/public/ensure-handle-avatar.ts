import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqEnsureHandleAvatar,
  ReqEnsureHandleAvatar,
  ReqWithVerifiedAuth,
  ResEnsureHandleAvatar,
  ResError,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { and, eq } from "drizzle-orm/sql/expressions";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { writeHandleAvatar } from "./handle-settings.js";

// Write the authenticated user's avatar for a handle they own.
//
// Two guards make this safe for the per-handle model:
//   1. Ownership — the target `handle` must have a handleBinding row for the
//      caller's userId. The host passes a VIEWER-selected handle; an app/iframe
//      cannot make the viewer write to a handle they don't own.
//   2. Asset authenticity — `cid` is resolved to the storage getURL via the
//      AssetUploads audit table, scoped to the caller's userId. The client never
//      supplies the stored URL, so it can't point an avatar at arbitrary bytes.
export async function ensureHandleAvatar(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureHandleAvatar>
): Promise<Result<ResEnsureHandleAvatar | ResError>> {
  const userId = req._auth.verifiedAuth.claims.userId;

  // 1. Ownership: the handle must belong to this user.
  const hb = vctx.sql.tables.handleBinding;
  const binding = await vctx.sql.db
    .select({ handle: hb.handle })
    .from(hb)
    .where(and(eq(hb.handle, req.handle), eq(hb.userId, userId)))
    .limit(1)
    .then((r) => r[0]);
  if (!binding) {
    return Result.Ok({ type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
  }

  // 2. Resolve the bare CID to the authoritative storage URI + mime, scoped to
  //    assets THIS user uploaded.
  const au = vctx.sql.tables.assetUploads;
  const upload = await vctx.sql.db
    .select({ assetURI: au.assetURI, mimeType: au.mimeType })
    .from(au)
    .where(and(eq(au.cid, req.cid), eq(au.userId, userId)))
    .limit(1)
    .then((r) => r[0]);
  if (!upload) {
    return Result.Ok({
      type: "vibes.diy.res-error",
      error: { message: `No uploaded asset for cid ${req.cid}` },
    } satisfies ResError);
  }

  const mime = upload.mimeType ?? req.mime ?? "application/octet-stream";
  const rWrite = await writeHandleAvatar(vctx, { handle: req.handle, userId, getURL: upload.assetURI, mime });
  if (rWrite.isErr()) return Result.Err(rWrite.Err());

  return Result.Ok({
    type: "vibes.diy.res-ensure-handle-avatar",
    handle: req.handle,
    getURL: rWrite.Ok().getURL,
    mime: rWrite.Ok().mime,
    updated: new Date().toISOString(),
  } satisfies ResEnsureHandleAvatar);
}

export const ensureHandleAvatarEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqEnsureHandleAvatar>,
  ResEnsureHandleAvatar | ResError | VibesDiyError
> = {
  hash: "ensure-handle-avatar",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqEnsureHandleAvatar(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqEnsureHandleAvatar>>,
        ResEnsureHandleAvatar | ResError | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const rResult = await ensureHandleAvatar(vctx, ctx.validated.payload);
      if (rResult.isErr()) {
        return Result.Err(rResult);
      }
      await ctx.send.send(ctx, rResult.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
