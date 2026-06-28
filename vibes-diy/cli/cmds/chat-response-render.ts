import { Result } from "@adviser/cement";
import { isBlockImage, isCodeBegin, isCodeEnd, isCodeLine, isToplevelLine } from "@vibes.diy/call-ai-v2";
import { isPromptRaw, isPromptReq } from "@vibes.diy/api-types";
import type { PromptAndBlockMsgs, ResChatResponseTurn, SectionEvent } from "@vibes.diy/api-types";
import { resolveSectionStream, type ResolveSectionStreamResult } from "./resolve-section-stream.js";

// Flatten a turn's sections (already blockSeq-ordered by the server) into the
// single ordered block-event stream the model produced. Used by every render
// mode below and by the `--files` resolver.
export function turnBlocks(turn: ResChatResponseTurn): PromptAndBlockMsgs[] {
  return turn.sections.flatMap((s) => s.blocks);
}

/**
 * Reconstruct an approximation of the verbatim markdown the model emitted,
 * from the stored block events — i.e. *before* the fence→file parser bound
 * paths. This is the "what did the model actually say?" view (issue #2655).
 *
 * Reconstruction rules (in stored emission order):
 *  - `block.toplevel.line` → the prose line verbatim. This is where an
 *    orphaned filename label lands when the parser failed to bind it to the
 *    following fence (e.g. a blank line separated label and fence) — the exact
 *    signature of a path mis-binding.
 *  - `block.code.begin` → an opening fence ```` ```<lang> <path> ````. The
 *    bound `path` is rendered in the info-string (real markdown fences here
 *    carry only the lang; the filename label is a separate preceding line the
 *    parser *consumes* into `path`). Surfacing the bound path on every fence
 *    is what makes a clobber — two fences both tagged `App.jsx` — obvious.
 *  - `block.code.line` → the code line verbatim.
 *  - `block.code.end` → a closing ```` ``` ````.
 *
 * Begin/end/stats/toplevel-begin/-end and prompt.* framing events carry no
 * text and are skipped.
 */
export function reconstructVerbatim(blocks: readonly PromptAndBlockMsgs[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (isToplevelLine(b)) {
      out.push(b.line);
    } else if (isCodeBegin(b)) {
      const info = b.path ? `${b.lang} ${b.path}` : b.lang;
      out.push("```" + info);
    } else if (isCodeLine(b)) {
      out.push(b.line);
    } else if (isCodeEnd(b)) {
      out.push("```");
    }
  }
  return out.join("\n");
}

/**
 * Render app-chat blocks (runtime/img mode) as readable text. Extends the
 * verbatim reconstruction with image-block placeholders so that image-gen
 * chats are not silently empty. The codegen `reconstructVerbatim` is
 * deliberately left unchanged — this function is the app-chats-specific
 * renderer.
 *
 * Image payloads have two shapes (see `BlockImageMsg` in block-stream.ts):
 *  - LLM-streamed: `{ url }` — raw data: URL or remote URL.
 *  - Server-side image-gen (Prodia etc.): `{ uploadId, cid }` — the asset has
 *    already been written to storage; display reads via Stage C's meta.url.
 *
 * We render both as `[image: <url-or-cid>]`.
 */
export function renderAppChatBlocks(blocks: readonly PromptAndBlockMsgs[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (isToplevelLine(b)) {
      out.push(b.line);
    } else if (isCodeBegin(b)) {
      const info = b.path ? `${b.lang} ${b.path}` : b.lang;
      out.push("```" + info);
    } else if (isCodeLine(b)) {
      out.push(b.line);
    } else if (isCodeEnd(b)) {
      out.push("```");
    } else if (isBlockImage(b)) {
      const ref = b.url ?? b.cid ?? b.uploadId ?? "(unknown)";
      out.push(`[image: ${ref}]`);
    }
  }
  return out.join("\n");
}

/** One raw block event per line, for piping into `jq` or capturing fixtures. */
export function renderJsonl(blocks: readonly PromptAndBlockMsgs[]): string {
  return blocks.map((b) => JSON.stringify(b)).join("\n");
}

/**
 * The byte-faithful raw model text for a turn (`--raw`): the exact markdown the
 * model streamed, captured upstream of the block parser, so consumed filename
 * labels and separator blank lines the parser drops are preserved. Returns
 * undefined when the turn has no `prompt.raw` block — turns generated before
 * byte-faithful capture shipped can't be backfilled. Multiple `prompt.raw`
 * blocks (shouldn't happen per turn) are concatenated.
 */
export function extractRawText(blocks: readonly PromptAndBlockMsgs[]): string | undefined {
  const parts = blocks.filter(isPromptRaw).map((b) => b.text);
  return parts.length === 0 ? undefined : parts.join("");
}

/**
 * Pull the user message text out of a turn's `prompt.req` block so the full
 * transcript (user prompt + model response) can be reconstructed. Mirrors the
 * extraction in `getChatDetails` but returns every user turn in the request.
 */
export function extractUserPrompts(blocks: readonly PromptAndBlockMsgs[]): string[] {
  const prompts: string[] = [];
  for (const b of blocks) {
    if (!isPromptReq(b)) continue;
    for (const m of b.request.messages) {
      if (m.role !== "user") continue;
      const text = m.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      if (text !== "") prompts.push(text);
    }
  }
  return prompts;
}

/**
 * Rebuild a `SectionEvent` stream from a stored turn so it can be piped through
 * `resolveSectionStream` — the exact resolver `generate`/`edit` use — to get
 * the resolved `path → content` map (`--files`). The `streamId` is the turn's
 * `promptId`, matching how blocks were stored.
 */
export function buildSectionStream(turn: ResChatResponseTurn): ReadableStream<SectionEvent> {
  const events: SectionEvent[] = turn.sections.map((s) => ({
    type: "vibes.diy.section-event",
    chatId: turn.chatId,
    promptId: turn.promptId,
    blockSeq: s.blockSeq,
    // Functionally unused by the resolver (it reads `event.blocks`); a fixed
    // epoch keeps the rebuilt event deterministic.
    timestamp: new Date(0),
    blocks: s.blocks,
  }));
  return new ReadableStream<SectionEvent>({
    start(controller) {
      for (const e of events) controller.enqueue(e);
      controller.close();
    },
  });
}

/**
 * Resolve the `path → content` map a turn produced (`--files`), seeding the
 * resolver so SEARCH/REPLACE edit turns resolve correctly.
 *
 * A stored edit turn often contains only SEARCH/REPLACE hunks, not whole
 * files. Replaying it through `resolveSectionStream` with no prior filesystem
 * would yield `{}` or apply errors — the live `edit` path seeds from disk and
 * the server seeds from the previous persisted filesystem. We reproduce that
 * here without any extra fetch by chaining: take this chat's turns oldest→
 * newest up to the selected one, and feed each turn's resolved files as the
 * seed for the next. The creation turn (full files) needs no seed; every later
 * edit composes on top of it.
 */
export async function resolveTurnFiles(
  turns: readonly ResChatResponseTurn[],
  selectedPromptId: string
): Promise<Result<ResolveSectionStreamResult>> {
  const selected = turns.find((t) => t.promptId === selectedPromptId);
  if (selected === undefined) {
    return Result.Err(new Error(`No turn with promptId ${selectedPromptId}`));
  }
  // Same-chat turns only (an app-level query may span chats), oldest-first.
  const chain = turns
    .filter((t) => t.chatId === selected.chatId)
    .slice()
    .sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  let seed = new Map<string, string>();
  let last: ResolveSectionStreamResult | undefined;
  for (const t of chain) {
    const r = await resolveSectionStream({ sectionStream: buildSectionStream(t), streamId: t.promptId, seed });
    if (r.isErr()) return Result.Err(r.Err());
    last = r.Ok();
    seed = new Map(Object.entries(last.files));
    if (t.promptId === selected.promptId) break;
  }
  if (last === undefined) {
    return Result.Ok({ files: {}, errors: [], snapshotCount: 0, applyErrorCount: 0, turnEndSeen: false, promptErrors: [] });
  }
  return Result.Ok(last);
}
