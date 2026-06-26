import { isCodeBegin, isCodeEnd, isCodeLine, isToplevelLine } from "@vibes.diy/call-ai-v2";
import { isPromptReq } from "@vibes.diy/api-types";
import type { PromptAndBlockMsgs, ResChatResponseTurn, SectionEvent } from "@vibes.diy/api-types";

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

/** One raw block event per line, for piping into `jq` or capturing fixtures. */
export function renderJsonl(blocks: readonly PromptAndBlockMsgs[]): string {
  return blocks.map((b) => JSON.stringify(b)).join("\n");
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
