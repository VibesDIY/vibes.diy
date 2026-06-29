import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetVibeChips,
  ReqGetVibeChips,
  ResChatResponseSection,
  ResChatResponseTurn,
  ResGetVibeChips,
  VibesDiyError,
  W3CWebSocketEvent,
  PromptAndBlockMsgs,
  ReqWithOptionalAuth,
  parseArrayWarning,
  latestTurnChips,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { ensureLogger } from "@vibes.diy/identity";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { isPublicReadable, checkDocAccess } from "./access-helpers.js";
import { selectLatestAppPerSlug } from "./select-app.js";
import { isHiddenForCaller } from "./unpublished-binding.js";
import { and, eq } from "drizzle-orm/sql/expressions";

// Anonymous suggestion-chips read path (#2755).
//
// The edit-card chips are the vibe's latest `▸` suggestions, derived from its
// PRIVATE chat. `getChatResponse` (the CLI read) is owner-gated, so non-owners
// and anonymous visitors got an empty, text-input-only card. This is the
// dedicated PROJECTION endpoint that delivers the #1896 "stranger lands on an
// app and sees curated transforms" experience without leaking the chat body:
//
//   1. Private chat stays the single source of truth — no second data model.
//   2. A dedicated endpoint for exactly ONE public slice (chips), not a generic
//      `chatSections` read future UI could over-read through.
//   3. The response is the explicit allowlist projection — only the chip
//      strings — and `latestTurnChips` caps them (terminal chip dropped, ≤3).
//   4. Visibility is enforced at the SAME boundary as app access: served when
//      the app is public-readable, or to a signed-in owner/member — never
//      owner-scoped, never raw private sections.
//   5. Read-only and non-persistent; access denials and parse skips are logged.
export const getVibeChipsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqGetVibeChips>, ResGetVibeChips | VibesDiyError> = {
  hash: "get-vibe-chips",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetVibeChips(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqGetVibeChips>>, ResGetVibeChips | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const logger = ensureLogger(vctx.sthis, "getVibeChips");

      const empty: ResGetVibeChips = {
        type: "vibes.diy.res-get-vibe-chips",
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        chips: [],
      };

      // Resolve the SAME app row getAppByFsId would serve (latest, preferring
      // production). This drives both the visibility gate and the version chips
      // are pinned to, so the projection can never diverge from the app a viewer
      // actually sees.
      const callerUserId = req._auth?.verifiedAuth.claims.userId;
      const app = await selectLatestAppPerSlug(vctx, { ownerHandle: req.ownerHandle, appSlug: req.appSlug });

      // Visibility gate at the SAME boundary as app access — mirroring
      // getAppByFsId's READ visibility so the chip projection never reaches a
      // viewer who couldn't see the app itself.
      //
      // (a) Owner / granted-member path. checkDocAccess resolves via handleBinding,
      // so it sees through publish state — an owner editing an unpublished draft,
      // and any granted member, keep their chips regardless of production/public.
      let isMember = false;
      if (callerUserId) {
        const { access } = await checkDocAccess(vctx, callerUserId, req.appSlug, req.ownerHandle);
        isMember = access !== "none";
      }

      // (b) Anonymous / non-member public path. Mirror getAppByFsId's non-owner
      // read EXACTLY: the slug must resolve to a PRODUCTION row, must NOT be
      // soft-unpublished (isHiddenForCaller — setUnpublish leaves publicAccess
      // untouched, so the tombstone is the real gate), AND must be publicly
      // readable. publicAccess alone is honored in dev for access-fn grants
      // (#2308), so it is NOT sufficient here — without these two extra gates a
      // dev-only or soft-unpublished slug carrying publicAccess would leak its
      // chip projection to anonymous callers (Codex review, #2755). A first-time
      // invite-token / auto-accept visitor whose grant getAppByFsId mints on its
      // own read is intentionally NOT auto-granted here — a read endpoint must
      // not mutate grants — so they briefly get []; the card settles once their
      // grant lands. (#2755)
      const publicVisible =
        !!app &&
        app.mode === "production" &&
        !(await isHiddenForCaller(vctx, {
          ownerHandle: app.ownerHandle,
          appSlug: app.appSlug,
          ownerUserId: app.userId,
          callerUserId,
        })) &&
        (await isPublicReadable(vctx, req.appSlug, req.ownerHandle));

      if (!isMember && !publicVisible) {
        logger.Debug().Str("ownerHandle", req.ownerHandle).Str("appSlug", req.appSlug).Msg("chips not visible to caller");
        await ctx.send.send(ctx, empty);
        return Result.Ok(EventoResult.Continue);
      }

      // Same ChatSections→PromptContexts shape as getChatResponse, but driven by
      // (ownerHandle, appSlug) directly — NO handleBinding/userId ownership join.
      // Access was decided above; here we only read the chat to project chips.
      const rows = await vctx.sql.db
        .select({
          chatId: vctx.sql.tables.chatSections.chatId,
          promptId: vctx.sql.tables.chatSections.promptId,
          fsId: vctx.sql.tables.promptContexts.fsId,
          promptCreated: vctx.sql.tables.promptContexts.created,
          sectionCreated: vctx.sql.tables.chatSections.created,
          blockSeq: vctx.sql.tables.chatSections.blockSeq,
          blocks: vctx.sql.tables.chatSections.blocks,
        })
        .from(vctx.sql.tables.chatContexts)
        .innerJoin(vctx.sql.tables.chatSections, eq(vctx.sql.tables.chatSections.chatId, vctx.sql.tables.chatContexts.chatId))
        .leftJoin(
          vctx.sql.tables.promptContexts,
          and(
            eq(vctx.sql.tables.promptContexts.chatId, vctx.sql.tables.chatSections.chatId),
            eq(vctx.sql.tables.promptContexts.promptId, vctx.sql.tables.chatSections.promptId)
          )
        )
        .where(
          and(eq(vctx.sql.tables.chatContexts.ownerHandle, req.ownerHandle), eq(vctx.sql.tables.chatContexts.appSlug, req.appSlug))
        );

      // Group section rows into turns (same as getChatResponse). `created`
      // prefers the PromptContexts timestamp, falling back to the section's own
      // `created` for failed turns that never got a PromptContexts row.
      const turns = new Map<string, ResChatResponseTurn>();
      for (const row of rows) {
        let turn = turns.get(row.promptId);
        if (turn === undefined) {
          turn = {
            chatId: row.chatId,
            promptId: row.promptId,
            created: row.promptCreated ?? row.sectionCreated,
            ...(row.fsId !== undefined && row.fsId !== null ? { fsId: row.fsId } : {}),
            sections: [],
          };
          turns.set(row.promptId, turn);
        }
        const { filtered: blocks, warning } = parseArrayWarning(row.blocks, PromptAndBlockMsgs);
        if (warning.length > 0) {
          logger.Warn().Any({ parseErrors: warning }).Msg("skip");
        }
        const section: ResChatResponseSection = { blockSeq: row.blockSeq, blocks };
        turn.sections.push(section);
      }
      for (const turn of turns.values()) {
        turn.sections.sort((a, b) => a.blockSeq - b.blockSeq);
      }
      const orderedTurns = Array.from(turns.values()).sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0));

      // Pin chips to the version the viewer actually sees. The caller may pin a
      // specific `fsId` (the version on screen); otherwise default to the
      // resolved app row's `fsId` rather than "globally newest turn", so a public
      // read never surfaces chips from a newer unpublished DRAFT turn the owner
      // started after publishing (Charlie review, #2755).
      const effectiveFsId = req.fsId ?? app?.fsId;

      // For a public (non-member) viewer, go further than preferring the
      // published turn: HARD-restrict candidates to that version's turns, so even
      // if the pinned turn is missing we fall back to [] — never to a draft turn.
      // Members may see drafts, so they keep the normal newest-turn fallback.
      const candidateTurns = !isMember && app?.fsId ? orderedTurns.filter((t) => t.fsId === app.fsId) : orderedTurns;

      // The ONLY thing that leaves this endpoint: the projected chip strings.
      const chips = latestTurnChips(candidateTurns, effectiveFsId);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-vibe-chips",
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        chips: [...chips],
      } satisfies ResGetVibeChips);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
