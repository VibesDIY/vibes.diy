import { Result, SendStatItem } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import { VibesApiSQLCtx } from "../types.js";
import { eq } from "drizzle-orm/sql/expressions";
import { MsgBase, parseArrayWarning, PromptAndBlockMsgs, SectionEvent } from "@vibes.diy/api-types";
import { BlockEndMsg, isBlockEnd } from "@vibes.diy/call-ai-v2";
import { ChatIdCtx } from "../svc-ws-send-provider.js";

interface ResendChatSectionsPrevMsgArgs {
  vctx: VibesApiSQLCtx;
  chatCtx: ChatIdCtx;
  tid: string;
  dst: string;
  send: (msg: MsgBase<SectionEvent>) => Promise<Result<SendStatItem<MsgBase<SectionEvent>>>>;
}

export async function resendChatSectionsPrevMsg(args: ResendChatSectionsPrevMsgArgs): Promise<Result<void>> {
  const { vctx, chatCtx, send, tid, dst } = args;

  const sections = await vctx.sql.db
    .select()
    .from(vctx.sql.tables.chatSections)
    .where(eq(vctx.sql.tables.chatSections.chatId, chatCtx.chatId))
    // .groupBy(vctx.sql.tables.chatSections.chatId, vctx.sql.tables.chatSections.promptId)
    .orderBy(vctx.sql.tables.chatSections.created, vctx.sql.tables.chatSections.promptId, vctx.sql.tables.chatSections.blockSeq);
  for (const section of sections) {
    const { filtered: blocks, warning } = parseArrayWarning(section.blocks, PromptAndBlockMsgs);
    if (warning.length > 0) {
      ensureLogger(vctx.sthis, "resendChatSectionsPrevMsg").Warn().Any({ parseErrors: warning }).Msg("skip");
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
    if (toSplice.length > 0) {
      console.log(
        `sql-resend`,
        sections.reduce((acc, s) => acc + (s.blocks as PromptAndBlockMsgs[]).length, 0),
        blocks.length,
        section.blocks
      );
    }

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
  for (const section of chatCtx.promptIds.values()) {
    // for (const collectedMsg of section.collectedMsgs) {
    const rSend = await send({
      payload: section,
      tid,
      src: "openChat",
      dst,
      ttl: 6,
    } satisfies MsgBase<SectionEvent>);
    if (rSend.isErr()) {
      return Result.Err(rSend);
    }
    // }
  }
  return Result.Ok(undefined);
}
