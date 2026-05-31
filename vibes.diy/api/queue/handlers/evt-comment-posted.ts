import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtCommentPosted, MsgBase, isEvtCommentPosted, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq } from "drizzle-orm/sql/expressions";
import { QueueCtx } from "../queue-ctx.js";
import { buildCommentEmbed, postEmbed } from "../intern/post-to-discord.js";

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
    await postEmbed(qctx, buildCommentEmbed(qctx, payload));

    const usb = qctx.sql.tables.handleBinding;
    const ownerRow = await qctx.sql.db
      .select({ userId: usb.userId })
      .from(usb)
      .where(eq(usb.handle, payload.ownerHandle))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (ownerRow?.userId) {
      await qctx.notifyUser(ownerRow.userId, {
        type: "vibes.diy.evt-user-notification",
        notificationType: "comment-posted",
        ownerHandle: payload.ownerHandle,
        appSlug: payload.appSlug,
      });
    }

    return Result.Ok(EventoResult.Continue);
  },
};
