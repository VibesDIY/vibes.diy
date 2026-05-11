import { exception2Result, Result } from "@adviser/cement";
import type { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import type { FileSystemRef } from "@vibes.diy/call-ai-v2";
import type { VibesApiSQLCtx } from "../types.js";

/**
 * Build a `PromptAndBlockMsgs[]` array that mirrors the structure of a real
 * LLM-turn-as-stored-in-ChatSections, but synthesized from a known set of
 * files. Used to seed a chat with a starting point so that the next real
 * LLM turn sees the existing app via `reconstructConversationMessages`.
 *
 * Two seed sites today:
 * - `vibes-diy push` first push: seeds the chat that future `edit` (or web
 *   follow-up) calls open against.
 * - `fork-app` remix path: seeds the destination chat with the source app's
 *   App.jsx so the remix prompt opens with the original code in scope.
 *
 * Layout per code file (in order):
 *   block.toplevel.begin → block.toplevel.line(`File: <path>`) → block.toplevel.end
 *   block.code.begin → block.code.line[] → block.code.end
 *
 * The toplevel header is what survives `reconstructConversationMessages` —
 * without it the LLM gets fenced code with no path label, which is fine for
 * a single-file seed but ambiguous once we seed multiple files.
 */
export interface SeedFile {
  readonly path: string;
  readonly lang: string;
  readonly content: string;
}

export interface BuildSeedSectionBlocksOpts {
  readonly chatId: string;
  readonly userText: string;
  readonly files: readonly SeedFile[];
  readonly blockId: string;
  readonly streamId: string;
  readonly promptId: string;
  readonly fsRef?: FileSystemRef;
  readonly timestamp?: Date;
}

export function buildSeedSectionBlocks(opts: BuildSeedSectionBlocksOpts): PromptAndBlockMsgs[] {
  const now = opts.timestamp ?? new Date();
  const baseBlock = { blockId: opts.blockId, streamId: opts.streamId, blockNr: 0, timestamp: now };
  const blocks: PromptAndBlockMsgs[] = [
    { type: "prompt.block-begin", chatId: opts.chatId, streamId: opts.streamId, seq: 0, timestamp: now },
    {
      type: "prompt.req",
      request: { messages: [{ role: "user", content: [{ type: "text", text: opts.userText }] }] },
      chatId: opts.chatId,
      streamId: opts.streamId,
      seq: 1,
      timestamp: now,
    },
    { type: "block.begin", ...baseBlock, seq: 2 },
  ];
  let seq = 3;
  let totalCodeLines = 0;
  let totalCodeBytes = 0;
  let totalToplevelLines = 0;
  let totalToplevelBytes = 0;
  for (const file of opts.files) {
    const toplevelSectionId = `${opts.promptId}-${file.path}-hdr`;
    const codeSectionId = `${opts.promptId}-${file.path}-code`;
    const headerLine = `File: ${file.path}`;
    blocks.push({ type: "block.toplevel.begin", sectionId: toplevelSectionId, ...baseBlock, seq: seq++ });
    blocks.push({
      type: "block.toplevel.line",
      sectionId: toplevelSectionId,
      line: headerLine,
      lineNr: 1,
      ...baseBlock,
      seq: seq++,
    });
    blocks.push({
      type: "block.toplevel.end",
      sectionId: toplevelSectionId,
      stats: { lines: 1, bytes: headerLine.length },
      ...baseBlock,
      seq: seq++,
    });
    totalToplevelLines += 1;
    totalToplevelBytes += headerLine.length;

    const lines = file.content.split("\n");
    blocks.push({
      type: "block.code.begin",
      sectionId: codeSectionId,
      lang: file.lang,
      path: file.path,
      ...baseBlock,
      seq: seq++,
    });
    for (let i = 0; i < lines.length; i += 1) {
      blocks.push({
        type: "block.code.line",
        sectionId: codeSectionId,
        lang: file.lang,
        path: file.path,
        line: lines[i],
        lineNr: i + 1,
        ...baseBlock,
        seq: seq++,
      });
    }
    blocks.push({
      type: "block.code.end",
      sectionId: codeSectionId,
      lang: file.lang,
      path: file.path,
      stats: { lines: lines.length, bytes: file.content.length },
      ...baseBlock,
      seq: seq++,
    });
    totalCodeLines += lines.length;
    totalCodeBytes += file.content.length;
  }
  blocks.push({
    type: "block.end",
    stats: {
      toplevel: { lines: totalToplevelLines, bytes: totalToplevelBytes },
      code: { lines: totalCodeLines, bytes: totalCodeBytes },
      image: { lines: 0, bytes: 0 },
      total: { lines: totalToplevelLines + totalCodeLines, bytes: totalToplevelBytes + totalCodeBytes },
    },
    usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    ...(opts.fsRef ? { fsRef: opts.fsRef } : {}),
    ...baseBlock,
    seq: seq++,
  });
  blocks.push({
    type: "prompt.block-end",
    chatId: opts.chatId,
    streamId: opts.streamId,
    seq: seq,
    timestamp: now,
  });
  return blocks;
}

/**
 * Insert a single ChatSection row carrying the synthetic seed turn. The
 * caller is expected to have already created the ChatContext.
 */
export async function seedChatSection(
  vctx: VibesApiSQLCtx,
  opts: BuildSeedSectionBlocksOpts
): Promise<Result<{ promptId: string }>> {
  const blocks = buildSeedSectionBlocks(opts);
  const rIns = await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.chatSections).values({
      chatId: opts.chatId,
      promptId: opts.promptId,
      blockSeq: 0,
      blocks,
      created: (opts.timestamp ?? new Date()).toISOString(),
    })
  );
  if (rIns.isErr()) return Result.Err(`Failed to seed chatSection: ${rIns.Err().message}`);
  return Result.Ok({ promptId: opts.promptId });
}
