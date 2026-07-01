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
import { STARTER_CHIP_SEED_PROMPT_ID } from "../intern/seed-starter-chips.js";
import { optAuth } from "../check-auth.js";
import { isPublicReadable, isWorldReadable, checkDocAccess } from "./access-helpers.js";
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

      // (b) Non-member path — "if you can see the app, you can see the chips."
      // Mirror getAppByFsId's non-owner READ visibility: the slug must resolve to
      // a PRODUCTION row (non-owners only ever see production) that is NOT
      // soft-unpublished (isHiddenForCaller — setUnpublish leaves publicAccess
      // untouched, so the tombstone is the real gate), and the viewer must be
      // able to get in:
      //   - anonymous → publicAccess only (isPublicReadable), matching the
      //     getAppByFsId "public-access" grant that anonymous callers receive;
      //   - signed-in → also auto-accept-request vibes (isWorldReadable),
      //     matching the auto-join grant getAppByFsId mints for signed-in
      //     visitors. We do NOT mint the grant here (a read must not mutate), but
      //     we still surface the chips they're entitled to see.
      // The production + tombstone gates stay in both arms, so a dev-only or
      // soft-unpublished slug carrying publicAccess never leaks (Codex review).
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

      // A "talk-only" turn (the model answered with suggestions but wrote no
      // file) has no `fsId` of its own. Treat it as belonging to the code version
      // that was LIVE when it happened — the `fsId` of the nearest OLDER turn —
      // so its `▸` chips attach to that deployed version instead of being
      // orphaned. Without this, two real flows land chip-less: a CLI-seeded vibe
      // (whose only versioned turn is `File: /App.jsx`, no chips) and a chat
      // "just give me ideas" turn (fsId null) that produced great chips but never
      // pinned to a version (#2755 follow-up). orderedTurns is newest-first, so we
      // walk oldest→newest carrying the most recent versioned fsId forward.
      let inheritedFsId: string | undefined;
      const normalizedTurns: ResChatResponseTurn[] = new Array(orderedTurns.length);
      for (let i = orderedTurns.length - 1; i >= 0; i--) {
        const turn = orderedTurns[i];
        if (turn.fsId !== undefined) {
          inheritedFsId = turn.fsId;
          normalizedTurns[i] = turn;
        } else if (turn.promptId === STARTER_CHIP_SEED_PROMPT_ID && app?.fsId !== undefined) {
          // A starter-chip seed turn (#2941) belongs to WHATEVER version is
          // currently served ("no version coupling" — seed-starter-chips.ts),
          // not to the chat's nearest older turn: CLI re-pushes mint releases
          // without appending chat turns, so on a re-pushed starter the
          // inherited fsId is a long-stale release and the non-member
          // hard-restrict below would filter the curated chips out entirely.
          // Pin it to the resolved app row instead. Deliberately does NOT feed
          // `inheritedFsId` — the seed is display metadata, not a code version
          // later talk-only turns happened on.
          normalizedTurns[i] = { ...turn, fsId: app.fsId };
        } else {
          normalizedTurns[i] = inheritedFsId !== undefined ? { ...turn, fsId: inheritedFsId } : turn;
        }
      }

      // Pin chips to the version the viewer actually sees. The caller may pin a
      // specific `fsId` (the version on screen); otherwise default to the
      // resolved app row's `fsId` rather than "globally newest turn", so a public
      // read never surfaces chips from a newer unpublished DRAFT turn the owner
      // started after publishing (Charlie review, #2755).
      const effectiveFsId = req.fsId ?? app?.fsId;

      // For a public (non-member) viewer, go further than preferring the
      // published turn: HARD-restrict candidates to that version's turns, so even
      // if the pinned turn is missing we fall back to [] — never to a draft turn.
      // Talk-only turns that INHERITED the published fsId (above) are included
      // here — they're commentary on the deployed version, not an unpublished
      // draft (a real draft keeps its own distinct fsId and is still excluded).
      // Members may see drafts, so they keep the normal newest-turn fallback.
      const candidateTurns = !isMember && app?.fsId ? normalizedTurns.filter((t) => t.fsId === app.fsId) : normalizedTurns;

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
