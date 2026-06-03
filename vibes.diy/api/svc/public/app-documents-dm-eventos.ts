import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListDmThreads,
  ReqListDmThreads,
  ResListDmThreads,
  DmThreadItem,
  reqMarkDmRead,
  ReqMarkDmRead,
  ResMarkDmRead,
  ReqWithVerifiedAuth,
  VibesDiyError,
  ResError,
  W3CWebSocketEvent,
  directChannelParticipants,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, inArray, sql } from "drizzle-orm";
import { max } from "drizzle-orm/sql";
import { type } from "arktype";
import { checkDirectChannelAccess } from "./db-acl-resolver.js";

// ── listDmThreads ────────────────────────────────────────────────────

export const listDmThreadsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqListDmThreads>, ResListDmThreads | VibesDiyError> = {
  hash: "list-dm-threads",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListDmThreads(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqListDmThreads>>, ResListDmThreads | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      // Get all ownerHandles for this user
      const t_usb = vctx.sql.tables.handleBinding;
      const mySlugRows = await vctx.sql.db.select({ handle: t_usb.handle }).from(t_usb).where(eq(t_usb.userId, userId));
      const myUserSlugs = mySlugRows.map((r) => r.handle);

      if (myUserSlugs.length === 0) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-list-dm-threads", status: "ok", items: [] } satisfies ResListDmThreads);
        return Result.Ok(EventoResult.Continue);
      }

      // Get all channels where any of my slugs participates
      const t_idx = vctx.sql.tables.directChannelIndex;
      const channelRows = await vctx.sql.db
        .select({ channelUserSlug: t_idx.channelHandle, ownerHandle: t_idx.handle })
        .from(t_idx)
        .where(inArray(t_idx.handle, myUserSlugs));

      const t_docs = vctx.sql.tables.appDocuments;
      const t_reads = vctx.sql.tables.directChannelReads;
      const limit = req.pager?.limit ?? 50;

      const channelSlugs = channelRows.map((r) => r.channelUserSlug);

      // Batch query 1: latest doc per channel using subquery (avoids N+1)
      const subq = vctx.sql.db
        .select({ ownerHandle: t_docs.ownerHandle, maxSeq: max(t_docs.seq).as("maxSeq") })
        .from(t_docs)
        .where(
          and(
            inArray(t_docs.ownerHandle, channelSlugs),
            eq(t_docs.appSlug, "dm"),
            eq(t_docs.dbName, "messages"),
            eq(t_docs.deleted, 0)
          )
        )
        .groupBy(t_docs.ownerHandle)
        .as("latest");

      const latestDocs = await vctx.sql.db
        .select()
        .from(t_docs)
        .innerJoin(subq, and(eq(t_docs.ownerHandle, subq.ownerHandle), eq(t_docs.seq, subq.maxSeq)));

      const latestDocByChannel = new Map(latestDocs.map((row) => [row.AppDocuments.ownerHandle, row.AppDocuments]));

      // Batch query 2: read rows for all channels at once
      const readRows = await vctx.sql.db
        .select({ channelUserSlug: t_reads.channelHandle, lastSeenSeq: t_reads.lastSeenSeq })
        .from(t_reads)
        .where(and(inArray(t_reads.channelHandle, channelSlugs), inArray(t_reads.handle, myUserSlugs)));
      const lastSeenByChannel = new Map(readRows.map((r) => [r.channelUserSlug, r.lastSeenSeq]));

      const items: DmThreadItem[] = channelRows.map(({ channelUserSlug, ownerHandle: mySlug }) => {
        const otherUserSlug = (directChannelParticipants(channelUserSlug) ?? []).find((h) => h !== mySlug) ?? "";
        const latestDoc = latestDocByChannel.get(channelUserSlug);
        const latestSeq = latestDoc?.seq ?? 0;
        const lastSeen = lastSeenByChannel.get(channelUserSlug) ?? 0;
        const unreadCount = Math.max(0, latestSeq - lastSeen);
        return {
          channelUserSlug,
          otherUserSlug,
          latestSeq,
          unreadCount,
          latestMessage: latestDoc
            ? {
                body: String((latestDoc.data as { body?: unknown }).body ?? ""),
                createdAt: latestDoc.created,
                authorHandle: String((latestDoc.data as { authorHandle?: unknown }).authorHandle ?? ""),
              }
            : undefined,
        };
      });

      const sorted = items
        .sort((a, b) => ((b.latestMessage?.createdAt ?? "") > (a.latestMessage?.createdAt ?? "") ? 1 : -1))
        .slice(0, limit);

      await ctx.send.send(ctx, { type: "vibes.diy.res-list-dm-threads", status: "ok", items: sorted } satisfies ResListDmThreads);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── markDmRead ───────────────────────────────────────────────────────

export const markDmReadEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqMarkDmRead>, ResMarkDmRead | VibesDiyError> = {
  hash: "mark-dm-read",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqMarkDmRead(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqMarkDmRead>>, ResMarkDmRead | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      // Verify participant
      const rAccess = await checkDirectChannelAccess(vctx, req.channelUserSlug, userId);
      if (rAccess.isErr() || !rAccess.Ok()) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      // Resolve which of my slugs is in this channel
      const participants = directChannelParticipants(req.channelUserSlug) ?? ["", ""];
      const t_usb = vctx.sql.tables.handleBinding;
      const slugRow = await vctx.sql.db
        .select({ handle: t_usb.handle })
        .from(t_usb)
        .where(and(eq(t_usb.userId, userId), inArray(t_usb.handle, participants)))
        .then((r) => r[0]);
      if (!slugRow) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }
      const myUserSlug = slugRow.handle;

      const t_reads = vctx.sql.tables.directChannelReads;
      await vctx.sql.db
        .insert(t_reads)
        .values({ channelHandle: req.channelUserSlug, handle: myUserSlug, lastSeenSeq: req.lastSeenSeq })
        .onConflictDoUpdate({
          target: [t_reads.channelHandle, t_reads.handle],
          // MAX so a delayed call never regresses the watermark
          set: { lastSeenSeq: sql`MAX(${t_reads.lastSeenSeq}, ${req.lastSeenSeq})` },
        });

      await ctx.send.send(ctx, { type: "vibes.diy.res-mark-dm-read", status: "ok" } satisfies ResMarkDmRead);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
