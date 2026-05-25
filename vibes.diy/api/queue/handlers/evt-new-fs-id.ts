import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtNewFsId, MsgBase, isEvtNewFsId, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import { QueueCtx } from "../queue-ctx.js";
import { processScreenShotEvent } from "../screen-shotter.js";
import { buildPublishEmbed, postEmbed } from "../intern/post-to-discord.js";

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
        .select({ releaseSeq: qctx.sql.tables.apps.releaseSeq })
        .from(qctx.sql.tables.apps)
        .where(
          and(
            eq(qctx.sql.tables.apps.userSlug, payload.userSlug),
            eq(qctx.sql.tables.apps.appSlug, payload.appSlug),
            eq(qctx.sql.tables.apps.fsId, payload.fsId)
          )
        )
        .orderBy(desc(qctx.sql.tables.apps.releaseSeq))
        .limit(1);
      const publishCount = rows[0]?.releaseSeq;
      await postEmbed(qctx, buildPublishEmbed(qctx, payload, publishCount));
    }
    return Result.Ok(EventoResult.Continue);
  },
};
