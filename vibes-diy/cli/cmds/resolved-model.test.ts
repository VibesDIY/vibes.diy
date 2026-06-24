import type { SectionEvent } from "@vibes.diy/api-types";
import { describe, expect, it } from "vitest";
import { modelFromSectionEvent } from "./resolved-model.js";

function sectionEvent(blocks: unknown[]): SectionEvent {
  return {
    type: "vibes.diy.section-event",
    chatId: "chat-1",
    promptId: "stream-1",
    blockSeq: 0,
    timestamp: new Date(),
    blocks: blocks as SectionEvent["blocks"],
  };
}

function promptReqBlock(model?: string) {
  return {
    type: "prompt.req",
    streamId: "stream-1",
    chatId: "chat-1",
    seq: 0,
    timestamp: new Date(),
    request: {
      ...(model !== undefined ? { model } : {}),
      messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    },
  };
}

describe("modelFromSectionEvent", () => {
  it("returns the model from a prompt.req block when present", () => {
    const evt = sectionEvent([promptReqBlock("anthropic/claude-opus-4-6")]);
    expect(modelFromSectionEvent(evt)).toBe("anthropic/claude-opus-4-6");
  });

  it("returns undefined when no prompt.req block is present", () => {
    const evt = sectionEvent([{ type: "prompt.block-begin", streamId: "s", chatId: "c", seq: 0, timestamp: new Date() }]);
    expect(modelFromSectionEvent(evt)).toBeUndefined();
  });

  it("returns undefined when the prompt.req block carries no model", () => {
    const evt = sectionEvent([promptReqBlock(undefined)]);
    expect(modelFromSectionEvent(evt)).toBeUndefined();
  });

  it("ignores empty blocks", () => {
    expect(modelFromSectionEvent(sectionEvent([]))).toBeUndefined();
  });
});
