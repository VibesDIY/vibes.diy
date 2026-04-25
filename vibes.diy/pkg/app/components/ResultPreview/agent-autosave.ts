import { isCodeLine } from "@vibes.diy/call-ai-v2";
import { isPromptReq, type PromptAndBlockMsgs } from "@vibes.diy/api-types";

/**
 * Decide whether the latest LLM turn should trigger an agent autosave.
 *
 * Returns true when the just-finished prompt block contains at least one code
 * section whose body has a `<<<<<<< SEARCH` marker — i.e., the model emitted
 * an aider-style replace edit. Replace turns currently don't round-trip
 * cleanly through server-side persistence (the streamed blocks per-turn lack
 * the prior file content as seed), so the client autosaves the resolved
 * buffer instead.
 *
 * Returns false for create-only turns (the streaming-persisted file is the
 * full create body — no autosave needed) and for blocks that include a
 * prompt.req from a save call (those are user-initiated, not a fresh LLM
 * turn).
 */
export function shouldAgentAutosave(blockMsgs: readonly PromptAndBlockMsgs[]): boolean {
  // A turn that contains a prompt.req is an LLM turn. Save blocks have no
  // prompt.req. We only autosave for LLM turns, so require one to be present.
  let hasPromptReq = false;
  let hasReplaceMarker = false;
  for (const msg of blockMsgs) {
    if (isPromptReq(msg)) {
      hasPromptReq = true;
      continue;
    }
    if (isCodeLine(msg) && msg.line.trimEnd().startsWith("<<<<<<< SEARCH")) {
      hasReplaceMarker = true;
    }
  }
  return hasPromptReq && hasReplaceMarker;
}
