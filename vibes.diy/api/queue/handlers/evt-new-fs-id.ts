import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtNewFsId, MsgBase, isEvtNewFsId, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import { QueueCtx } from "../queue-ctx.js";
import { processScreenShotEvent } from "../screen-shotter.js";
import { buildPublishEmbed, postEmbed } from "../intern/post-to-discord.js";
import { notifyRemixSourceOwner, notifyVibePublished } from "@vibes.diy/api-svc";

export const evtNewFsIdEvento: EventoHandler<unknown, MsgBase<EvtNewFsId>, void> = {
  hash: "evt-new-fs-id",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtNewFsId(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtNewFsId>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtNewFsId>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const payload = ctx.validated.payload;
    // console.log("Handling evt-new-fs-id event with payload:", payload);
    const res = await processScreenShotEvent(qctx, payload);
    if (res.isErr()) {
      console.error("Error processing screen shot event:", res.Err());
    }
    if (payload.mode === "production") {
      const rows = await qctx.sql.db
        .select({
          releaseSeq: qctx.sql.tables.apps.releaseSeq,
          userId: qctx.sql.tables.apps.userId,
          ownerHandle: qctx.sql.tables.apps.ownerHandle,
          appSlug: qctx.sql.tables.apps.appSlug,
          meta: qctx.sql.tables.apps.meta,
        })
        .from(qctx.sql.tables.apps)
        .where(
          and(
            eq(qctx.sql.tables.apps.ownerHandle, payload.ownerHandle),
            eq(qctx.sql.tables.apps.appSlug, payload.appSlug),
            eq(qctx.sql.tables.apps.fsId, payload.fsId)
          )
        )
        .orderBy(desc(qctx.sql.tables.apps.releaseSeq))
        .limit(1);
      const publishCount = rows[0]?.releaseSeq;
      await postEmbed(qctx, buildPublishEmbed(qctx, payload, publishCount));

      // Classic-remix path: a remix is forked in dev and surfaces to the
      // source owner only on its first production publish. Dedupe is handled
      // by emitNotification, so re-publishes are naturally once-only.
      const publishedRow = rows[0];
      if (publishedRow) {
        await notifyRemixSourceOwner(qctx, publishedRow);
      }

      // Persist a vibe-published notification for the owner (and fan out the
      // live bell). Dedupe is per-release (fsId), so re-delivery of the same
      // publish event does not double-notify.
      await notifyVibePublished(qctx, payload);
    }
    return Result.Ok(EventoResult.Continue);
  },
};
