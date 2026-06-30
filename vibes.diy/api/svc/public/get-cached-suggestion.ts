import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetCachedSuggestion,
  ReqGetCachedSuggestion,
  ResGetCachedSuggestion,
  VibesDiyError,
  W3CWebSocketEvent,
  ReqWithOptionalAuth,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { ensureLogger } from "@vibes.diy/identity";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { isPublicReadable, isWorldReadable, checkDocAccess } from "./access-helpers.js";
import { selectLatestAppPerSlug } from "./select-app.js";
import { isHiddenForCaller } from "./unpublished-binding.js";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { cachedSuggestionSourceIsPublic } from "./get-app-by-fsid.js";

// Anonymous cached-suggestion read path (#2801) — the read lane's reader.
//
// Given a content-address `key` for a source vibe, return the staged result
// `fsId` so the client can navigate to it as an instant page-view. This is the
// projection counterpart to `cachedSuggestionGrant` in get-app-by-fsid: the
// reader decides "is there a servable cached result for this click?", the grant
// decides "may THIS viewer read that exact staged fsId?". Both must agree, so the
// reader applies the SAME guarantees:
//
//   1. Visibility gate is identical to getVibeChips — served when the app is
//      public-readable, or to a signed-in owner/member; never owner-scoped.
//   2. Source-was-public is re-verified via the shared
//      `grantableCachedSuggestionSource` helper (no policy skew with the grant) —
//      a cached read must be a transform of already-public code (Codex P1).
//   3. A miss / not-visible / non-public-source returns the SAME response with
//      `fsId` absent — never an existence oracle.
//   4. Read-only and non-persistent.
export const getCachedSuggestionEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqGetCachedSuggestion>,
  ResGetCachedSuggestion | VibesDiyError
> = {
  hash: "get-cached-suggestion",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetCachedSuggestion(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithOptionalAuth<ReqGetCachedSuggestion>>,
        ResGetCachedSuggestion | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const logger = ensureLogger(vctx.sthis, "getCachedSuggestion");

      // `fsId` absent is the uniform miss / not-visible answer (no oracle).
      const miss: ResGetCachedSuggestion = {
        type: "vibes.diy.res-get-cached-suggestion",
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        key: req.key,
      };

      const callerUserId = req._auth?.verifiedAuth.claims.userId;
      const app = await selectLatestAppPerSlug(vctx, { ownerHandle: req.ownerHandle, appSlug: req.appSlug });

      // Visibility gate — byte-identical to getVibeChips so the reader never
      // reaches a viewer who couldn't see the app itself (Charlie: reuse the same
      // public-visibility semantics to avoid policy skew).
      let isMember = false;
      if (callerUserId) {
        const { access } = await checkDocAccess(vctx, callerUserId, req.appSlug, req.ownerHandle);
        isMember = access !== "none";
      }
      let publicVisible = false;
      if (
        !isMember &&
        app &&
        app.mode === "production" &&
        !(await isHiddenForCaller(vctx, {
          ownerHandle: app.ownerHandle,
          appSlug: app.appSlug,
          ownerUserId: app.userId,
          callerUserId,
        }))
      ) {
        publicVisible = callerUserId
          ? await isWorldReadable(vctx, req.appSlug, req.ownerHandle)
          : await isPublicReadable(vctx, req.appSlug, req.ownerHandle);
      }
      if (!isMember && !publicVisible) {
        await ctx.send.send(ctx, miss);
        return Result.Ok(EventoResult.Continue);
      }

      // Resolve the staged fsId from the BLESS map — the serve-eligibility layer.
      // A produced-but-unblessed (or revoked) result is absent here, so it
      // uniformly misses → the client forks (deny-by-default / fail-to-fork). Only
      // a result the owner explicitly blessed is servable as an in-namespace stay.
      // The source-was-public recheck still runs (same helper the grant uses).
      const rAppSet = await ensureAppSettings(vctx, {
        type: "vibes.diy.req-ensure-app-settings",
        appSlug: req.appSlug,
        ownerHandle: req.ownerHandle,
      });
      if (rAppSet.isErr()) {
        await ctx.send.send(ctx, miss);
        return Result.Ok(EventoResult.Continue);
      }
      const cachedSuggestionBlesses = rAppSet.Ok().settings.entry.cachedSuggestionBlesses;
      const entry = cachedSuggestionBlesses?.[req.key];
      if (!entry) {
        await ctx.send.send(ctx, miss);
        return Result.Ok(EventoResult.Continue);
      }
      // Key-specific source-was-public check on THIS exact entry (not an fsId
      // first-match across entries; Charlie #2890), same predicate the grant uses.
      const sourcePublic = await cachedSuggestionSourceIsPublic(vctx, {
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        sourceFsId: entry.sourceFsId,
      });
      if (!sourcePublic) {
        // Entry exists but its source version is no longer public → not servable.
        await ctx.send.send(ctx, miss);
        return Result.Ok(EventoResult.Continue);
      }

      logger
        .Debug()
        .Str("ownerHandle", req.ownerHandle)
        .Str("appSlug", req.appSlug)
        .Str("fsId", entry.fsId)
        .Msg("cached-suggestion hit");
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-cached-suggestion",
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        key: req.key,
        fsId: entry.fsId,
      } satisfies ResGetCachedSuggestion);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
