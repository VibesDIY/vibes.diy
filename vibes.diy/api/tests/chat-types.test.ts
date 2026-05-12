import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { reqCreationPromptChatSection } from "../types/chat.js";

describe("reqCreationPromptChatSection: selected wire shape", () => {
  it("accepts selected: { kind: 'version', fsId }", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
      selected: { kind: "version", fsId: "z3xyz" },
    });
    expect(r).not.toBeInstanceOf(type.errors);
  });

  it("accepts selected: { kind: 'draft', files }", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [{ role: "user", content: [{ type: "text", text: "go" }] }] },
      selected: {
        kind: "draft",
        files: [
          {
            type: "code-block",
            lang: "jsx",
            content: "export default function App() { return null; }",
            filename: "/App.jsx",
          },
        ],
      },
    });
    expect(r).not.toBeInstanceOf(type.errors);
  });

  it("rejects selected with unknown kind", () => {
    const r = reqCreationPromptChatSection({
      type: "vibes.diy.req-prompt-chat-section",
      mode: "chat",
      auth: { type: "device-id", token: "t" },
      chatId: "c1",
      outerTid: "tid",
      prompt: { messages: [] },
      selected: { kind: "bogus" },
    });
    expect(r).toBeInstanceOf(type.errors);
  });
});
