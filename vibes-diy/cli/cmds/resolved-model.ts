import { isPromptModelResolved, isPromptReq } from "@vibes.diy/api-types";
import type { SectionEvent } from "@vibes.diy/api-types";

// Pull the resolved model id out of a section event's blocks, if any.
//
// Two sources, in preference order:
//  1. `prompt.model-resolved` — the model the turn was ACTUALLY dispatched
//     with, emitted post-dispatch only when a catalog fallback swapped models
//     (#2628). When present it's authoritative, so it wins.
//  2. `prompt.req.request.model` — the pre-dispatch resolved model the server
//     records even with no --model override, streamed before any fallback.
//
// Lets the CLI surface "Generating with <model>" / "Editing with <model>" and
// correct it if a fallback later reports a different model. Returns undefined
// when no block carries a model.
export function modelFromSectionEvent(evt: SectionEvent): string | undefined {
  for (const block of evt.blocks) {
    if (isPromptModelResolved(block) && block.model) {
      return block.model;
    }
  }
  for (const block of evt.blocks) {
    if (isPromptReq(block) && block.request.model) {
      return block.request.model;
    }
  }
  return undefined;
}
