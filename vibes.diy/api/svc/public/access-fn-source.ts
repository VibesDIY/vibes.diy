import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  exception2Result,
  stream2uint8array,
} from "@adviser/cement";
import { MsgBase, ReqWithOptionalAuth, VibesDiyError, ResError, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { ReqVibeAccessFnSource, ResVibeAccessFnSource, isReqVibeAccessFnSource } from "@vibes.diy/vibe-types";
import { and, eq } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";

export interface ResolveAccessFnSourceArgs {
  ownerHandle: string;
  appSlug: string;
  cid: string;
}

// Resolves a vibe's full access.js source bytes for a content-addressed CID.
// Primary path: read the binding's accessFnAssetUri via the storage abstraction
// (handles SQL and R2). Fallback (legacy rows with a null URI): the CID *is* the
// Assets.assetId, so read the content blob directly. Both paths require a
// matching AccessFunctionBindings row for (ownerHandle, appSlug, cid) — the
// fallback is NOT a global Assets lookup, so a caller can't pair a CID it learned
// elsewhere (e.g. a private upload) with arbitrary app identifiers to read it.
// Returns { cid, source: null } when nothing is bound — callers treat that as
// "unknown", never a hard deny.
export async function resolveAccessFnSource(
  vctx: VibesApiSQLCtx,
  args: ResolveAccessFnSourceArgs
): Promise<Result<{ cid: string; source: string | null }>> {
  const { ownerHandle, appSlug, cid } = args;
  return exception2Result(async () => {
    const tAfb = vctx.sql.tables.accessFunctionBindings;
    const rows = await vctx.sql.db
      .select({ accessFnAssetUri: tAfb.accessFnAssetUri })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug), eq(tAfb.accessFnCid, cid)));

    // The CID must be bound to THIS app. No matching binding → not authorized to
    // read it; do not fall through to a global Assets lookup.
    if (rows.length === 0) return { cid, source: null };

    const assetUri = rows.find((r) => r.accessFnAssetUri !== null && r.accessFnAssetUri !== undefined)?.accessFnAssetUri;
    if (assetUri !== null && assetUri !== undefined) {
      const rFetch = await vctx.storage.fetch(assetUri);
      if (rFetch.type === "fetch.ok") {
        const bytes = await stream2uint8array(rFetch.data);
        return { cid, source: vctx.sthis.txt.decode(bytes) };
      }
    }

    // Legacy fallback (binding exists but accessFnAssetUri is null): the CID is
    // the Assets.assetId. Reached only because a matching binding was found above.
    const tAssets = vctx.sql.tables.assets;
    const assetRows = await vctx.sql.db.select({ content: tAssets.content }).from(tAssets).where(eq(tAssets.assetId, cid));
    const content = assetRows[0]?.content;
    if (content !== undefined && content !== null) {
      return { cid, source: vctx.sthis.txt.decode(content as Uint8Array) };
    }

    return { cid, source: null };
  });
}

// Evento handler — used by the WS bridge to serve vibe.req.accessFnSource.
// Uses optAuth for framework consistency (same as whoAmIEvento); auth is not
// required to retrieve source bytes — the CID is content-addressed and the
// bytes are already available to the running iframe anyway.
export const accessFnSourceEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqVibeAccessFnSource>,
  ResVibeAccessFnSource | VibesDiyError
> = {
  hash: "vibe.accessFnSource",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (!isReqVibeAccessFnSource(msg.payload)) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqVibeAccessFnSource }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithOptionalAuth<ReqVibeAccessFnSource>>,
        ResVibeAccessFnSource | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const rRes = await resolveAccessFnSource(vctx, {
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        cid: req.cid,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: rRes.Err().message },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        type: "vibe.res.accessFnSource",
        tid: req.tid,
        cid: r.cid,
        source: r.source,
      } satisfies ResVibeAccessFnSource);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
