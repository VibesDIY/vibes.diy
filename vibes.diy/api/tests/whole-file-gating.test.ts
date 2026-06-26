import { describe, expect, it } from "vitest";
import { isReqCreationPromptChatSection } from "../types/chat.js";

// Codex P1 claimed whole-file routing matches edit turns too. On this head the
// route is gated by isReqCreationPromptChatSection(orig) AND an empty version
// timeline (prompt-chat-section.ts:2279-2283). This locks the first half: an
// application/edit request must never read as a creation request.
describe("whole-file gating", () => {
  it("treats an application/edit prompt-chat-section as NOT a creation request", () => {
    const editReq = {
      type: "vibes.diy.req-prompt-chat-section",
      mode: "runtime",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [], model: "x" },
    };
    expect(isReqCreationPromptChatSection(editReq)).toBe(false);
  });
});
