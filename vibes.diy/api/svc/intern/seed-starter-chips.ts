import { exception2Result, Result } from "@adviser/cement";
import type { PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { and, eq } from "drizzle-orm/sql/expressions";
import { desc } from "drizzle-orm";
import type { VibesApiSQLCtx } from "../types.js";

// Synthetic "starter chips" seed (#2941). The hand-tuned curated starter vibes
// (the Blooms) were `vibes-diy push`-ed, so their only chat turn is the
// `File: /App.jsx` seed — no `▸` suggestion chips. This seeds a TALK-ONLY
// narration turn whose trailing `▸` lines are the curated chips, so the existing
// `getVibeChips` projection (`latestTurnChips` → `chipsFromNarration`) returns
// them with NO chip-pipeline change. The on-ramp spine pre-check then matches a
// clicked chip against the curated graph and navigates cross-slug.
//
// **Non-producible by construction (Charlie #2950):** this writes ONLY chat
// narration — never a `cachedSuggestions` produce/bless entry — so a seeded chip
// can never become a servable cached-suggestion tuple; produce→bless still only
// originates from real codegen. Display-only.
//
// **Talk-only:** no Apps row, no `PromptContexts` row, no `fsId` of its own. A
// chips-only turn inherits the deployed version's `fsId` in `getVibeChips`
// (the "talk-only turn inherits the nearest older versioned fsId" rule), so the
// chips attach to whatever version is currently live — no version coupling here.

/** The deterministic promptId for the seed turn — one per chat, so re-seeding is
 *  idempotent (delete-then-insert under the same key rather than piling up turns). */
export const STARTER_CHIP_SEED_PROMPT_ID = "starter-chip-seed";

export interface BuildStarterChipSeedBlocksOpts {
  readonly chatId: string;
  readonly promptId: string;
  readonly blockId: string;
  readonly streamId: string;
  /** The curated chip labels, in order — rendered as trailing `▸` lines. */
  readonly chips: readonly string[];
  /** Optional prose shown above the chips (stays in the narration prose, not a chip). */
  readonly leadLine?: string;
  readonly timestamp?: Date;
}

/**
 * Build a `PromptAndBlockMsgs[]` array for a talk-only narration turn whose
 * narration ends with `▸ <chip>` lines. Mirrors the block shapes a real LLM turn
 * stores (so it passes the same `PromptAndBlockMsgs` validation `getVibeChips`
 * runs), but carries a single toplevel narration section and NO code / `fsRef`.
 */
export function buildStarterChipSeedBlocks(opts: BuildStarterChipSeedBlocksOpts): PromptAndBlockMsgs[] {
  const now = opts.timestamp ?? new Date();
  const base = { blockId: opts.blockId, streamId: opts.streamId, blockNr: 0, timestamp: now };
  const sectionId = `${opts.promptId}-chips`;
  const lead = opts.leadLine ?? "Make it yours:";
  // The trailing `▸` group is what `chipsFromNarration` peels into chips; the lead
  // line stays as prose. (chipsFromNarration caps at 3 and drops the terminal chip.)
  const narrationLines = [lead, ...opts.chips.map((c) => `▸ ${c}`)];
  const bytes = narrationLines.join("\n").length;

  const blocks: PromptAndBlockMsgs[] = [
    { type: "prompt.block-begin", chatId: opts.chatId, streamId: opts.streamId, seq: 0, timestamp: now },
    {
      type: "prompt.req",
      request: { messages: [{ role: "user", content: [{ type: "text", text: "(starter chips)" }] }] },
      chatId: opts.chatId,
      streamId: opts.streamId,
      seq: 1,
      timestamp: now,
    },
    { type: "block.begin", ...base, seq: 2 },
    { type: "block.toplevel.begin", sectionId, ...base, seq: 3 },
  ];
  let seq = 4;
  for (let i = 0; i < narrationLines.length; i += 1) {
    blocks.push({ type: "block.toplevel.line", sectionId, line: narrationLines[i], lineNr: i + 1, ...base, seq: seq++ });
  }
  blocks.push({ type: "block.toplevel.end", sectionId, stats: { lines: narrationLines.length, bytes }, ...base, seq: seq++ });
  blocks.push({
    type: "block.end",
    stats: {
      toplevel: { lines: narrationLines.length, bytes },
      code: { lines: 0, bytes: 0 },
      image: { lines: 0, bytes: 0 },
      total: { lines: narrationLines.length, bytes },
    },
    usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    ...base,
    seq: seq++,
  });
  blocks.push({ type: "prompt.block-end", chatId: opts.chatId, streamId: opts.streamId, seq, timestamp: now });
  return blocks;
}

export interface SeedStarterChipsOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly chips: readonly string[];
  readonly leadLine?: string;
  readonly timestamp?: Date;
}

export interface SeedStarterChipsResult {
  readonly chatId: string;
  readonly promptId: string;
  readonly seededChips: readonly string[];
}

/**
 * Idempotently seed a starter vibe's curated suggestion chips (#2941).
 *
 * Resolves the vibe's existing chat (created by `vibes-diy push`), deletes any
 * prior seed turn under {@link STARTER_CHIP_SEED_PROMPT_ID}, and inserts a fresh
 * talk-only narration turn carrying the `▸` chips — timestamped now, so it's the
 * newest turn and `getVibeChips` surfaces it. Re-running replaces, never stacks.
 *
 * Returns an error (does not create a chat) when the vibe has no chat context —
 * the vibe must be pushed first. Caller is responsible for authorization.
 */
export async function seedStarterChips(vctx: VibesApiSQLCtx, opts: SeedStarterChipsOpts): Promise<Result<SeedStarterChipsResult>> {
  if (opts.chips.length === 0) return Result.Err("seedStarterChips: no chips to seed");

  const ctxRows = await vctx.sql.db
    .select({ chatId: vctx.sql.tables.chatContexts.chatId })
    .from(vctx.sql.tables.chatContexts)
    .where(
      and(eq(vctx.sql.tables.chatContexts.ownerHandle, opts.ownerHandle), eq(vctx.sql.tables.chatContexts.appSlug, opts.appSlug))
    )
    .orderBy(desc(vctx.sql.tables.chatContexts.created))
    .limit(1);

  const chatId = ctxRows[0]?.chatId;
  if (!chatId) {
    return Result.Err(`seedStarterChips: no chat context for ${opts.ownerHandle}/${opts.appSlug} (push the vibe first)`);
  }

  const promptId = STARTER_CHIP_SEED_PROMPT_ID;
  const now = opts.timestamp ?? new Date();
  const blockId = vctx.sthis.nextId(12).str;

  const blocks = buildStarterChipSeedBlocks({
    chatId,
    promptId,
    blockId,
    streamId: blockId,
    chips: opts.chips,
    ...(opts.leadLine ? { leadLine: opts.leadLine } : {}),
    timestamp: now,
  });

  const rWrite = await exception2Result(async () => {
    // Idempotent: drop the prior seed turn (deterministic promptId) before
    // inserting the fresh one, so re-seeding updates rather than duplicates.
    await vctx.sql.db
      .delete(vctx.sql.tables.chatSections)
      .where(and(eq(vctx.sql.tables.chatSections.chatId, chatId), eq(vctx.sql.tables.chatSections.promptId, promptId)));
    await vctx.sql.db.insert(vctx.sql.tables.chatSections).values({
      chatId,
      promptId,
      blockSeq: 0,
      blocks,
      created: now.toISOString(),
    });
  });
  if (rWrite.isErr()) return Result.Err(`seedStarterChips: write failed: ${rWrite.Err().message}`);

  return Result.Ok({ chatId, promptId, seededChips: opts.chips });
}
