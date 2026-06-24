import { isPromptReq } from "@vibes.diy/api-types";
import type { SectionEvent } from "@vibes.diy/api-types";

// Pull the resolved model id out of a section event's prompt.req block, if any.
// The server records the model it actually dispatched on prompt.req.request.model
// (even when the client sent no --model override), so the CLI can surface
// "Generating with <model>" / "Editing with <model>" once the first such block
// streams back. Returns undefined when no prompt.req block carries a model.
export function modelFromSectionEvent(evt: SectionEvent): string | undefined {
  for (const block of evt.blocks) {
    if (isPromptReq(block) && block.request.model) {
      return block.request.model;
    }
  }
  return undefined;
}
