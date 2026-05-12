import { describe, expect, it } from "vitest";
import { isReqInspectPromptChatSection, isResInspectPromptChatSection } from "@vibes.diy/api-types";

describe("inspect prompt types", () => {
  it("validates a request shape", () => {
    expect(
      isReqInspectPromptChatSection({
        type: "vibes.diy.req-inspect-prompt-chat-section",
        auth: { type: "device-id", token: "x" },
        chatId: "chat-1",
        mode: "chat",
        prompt: { messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }] },
      })
    ).toBe(true);
  });

  it("validates a response shape", () => {
    expect(
      isResInspectPromptChatSection({
        type: "vibes.diy.res-inspect-prompt-chat-section",
        chatId: "chat-1",
        model: "anthropic/claude-sonnet-4-6",
        messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      })
    ).toBe(true);
  });

  it("rejects wrong type discriminator", () => {
    expect(isReqInspectPromptChatSection({ type: "wrong" })).toBe(false);
  });
});
