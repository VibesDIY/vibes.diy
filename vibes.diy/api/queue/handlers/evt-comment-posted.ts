import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtCommentPosted, MsgBase, isEvtCommentPosted, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { QueueCtx } from "../queue-ctx.js";
import { buildCommentEmbed, postEmbed } from "../intern/post-to-discord.js";
import { eq } from "drizzle-orm/sql/expressions";

export const evtCommentPostedEvento: EventoHandler<unknown, MsgBase<EvtCommentPosted>, void> = {
  hash: "evt-comment-posted",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtCommentPosted(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtCommentPosted>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtCommentPosted>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const payload = ctx.validated.payload;

    const owner = await qctx.sql.db
      .select({ userId: qctx.sql.tables.userSlugBinding.userId })
      .from(qctx.sql.tables.userSlugBinding)
      .where(eq(qctx.sql.tables.userSlugBinding.userSlug, payload.userSlug))
      .then((rows) => rows[0]);

    if (owner) {
      const rNotify = await qctx.notifyUserNotification(owner.userId, payload);
      if (rNotify.isErr()) {
        console.warn("Failed to fan out comment-posted websocket notification", rNotify.Err());
      }
    }

    await postEmbed(qctx, buildCommentEmbed(qctx, payload));
    return Result.Ok(EventoResult.Continue);
  },
};
