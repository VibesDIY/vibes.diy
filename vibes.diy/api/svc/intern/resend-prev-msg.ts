import { Result, SendStatItem } from "@adviser/cement";
import { VibesApiSQLCtx } from "../types.js";
import { sqlChatSections } from "../sql/vibes-diy-api-schema.js";
import { eq } from "drizzle-orm/sql/expressions";
import { MsgBase, PromptAndBlockMsgs, SectionEvent } from "@vibes.diy/api-types";
import { type } from "arktype";
import { BlockEndMsg, isBlockEnd } from "@vibes.diy/call-ai-v2";

interface ResendChatSectionsPrevMsgArgs {
  vctx: VibesApiSQLCtx;
  chatId: string;
  tid: string;
  dst: string;
  send: (msg: MsgBase<SectionEvent>) => Promise<Result<SendStatItem<MsgBase<SectionEvent>>>>;
}

export async function resendChatSectionsPrevMsg(args: ResendChatSectionsPrevMsgArgs): Promise<Result<void>> {
  const { vctx, chatId, send, tid, dst } = args;
  const sections = await vctx.db
    .select()
    .from(sqlChatSections)
    .where(eq(sqlChatSections.chatId, chatId))
    // .groupBy(sqlChatSections.chatId, sqlChatSections.promptId)
    .orderBy(sqlChatSections.created, sqlChatSections.promptId, sqlChatSections.blockSeq)
    .all();
  for (const section of sections) {
    const blocks = PromptAndBlockMsgs.array()(section.blocks);
    if (blocks instanceof type.errors) {
      let idx = 0;
      for (const block of section.blocks as []) {
        const pabm = PromptAndBlockMsgs(block);
        if (pabm instanceof type.errors) {
          return Result.Err(
            `Invalid block data for section ${idx} in chat ${section.chatId} - ${pabm.summary} - ${JSON.stringify(block)}`
          );
        }
        idx++;
      }
      return Result.Err(`Invalid blocks data in chat ${section.chatId} - ${blocks.summary} - ${JSON.stringify(blocks)}`);
    }

    // Might be removed in future
    let fixDoubleBlockEnd: BlockEndMsg | undefined = undefined;
    const toSplice: number[] = [];
    blocks.forEach((block, index) => {
      if (isBlockEnd(block)) {
        if (fixDoubleBlockEnd && block.blockId === fixDoubleBlockEnd.blockId) {
          toSplice.push(index);
        }
        fixDoubleBlockEnd = block;
      }
    });
    for (const index of toSplice.reverse()) {
      blocks.splice(index, 1);
    }
    // Might be removed in future

    if (blocks.length > 0) {
      const rCurrentMsg: Result<SendStatItem<MsgBase<SectionEvent>>> = await send({
        payload: {
          type: "vibes.diy.section-event",
          chatId: section.chatId,
          promptId: section.promptId,
          blockSeq: section.blockSeq,
          timestamp: new Date(section.created),
          blocks,
        },
        tid,
        src: "openChat",
        dst,
        ttl: 6,
      } satisfies MsgBase<SectionEvent>);
      if (rCurrentMsg.isErr()) {
        return Result.Err(rCurrentMsg);
      }
      if (rCurrentMsg.Ok().item.isErr()) {
        return Result.Err(rCurrentMsg.Ok().item);
      }
    }
  }
  return Result.Ok(undefined);
}
