import { describe, expect, it } from "vitest";
import { buildSeedSectionBlocks, reconstructConversationMessages } from "@vibes.diy/api-svc";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";

function firstText(msg: ChatMessage): string {
  const part = msg.content.find((c) => c.type === "text");
  return part?.type === "text" ? part.text : "";
}

describe("buildSeedSectionBlocks", () => {
  it("round-trips through reconstructConversationMessages as a user+assistant pair", () => {
    const blocks = buildSeedSectionBlocks({
      chatId: "chat-1",
      promptId: "prompt-1",
      blockId: "block-1",
      streamId: "stream-1",
      userText: "Initial push of the app.",
      files: [{ path: "/App.jsx", lang: "jsx", content: "import React from 'react'\nexport default () => <h1>hi</h1>\n" }],
    });
    const msgs = reconstructConversationMessages(blocks);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("user");
    expect(firstText(msgs[0])).toBe("Initial push of the app.");
    expect(msgs[1].role).toBe("assistant");
    const assistant = firstText(msgs[1]);
    expect(assistant).toContain("File: /App.jsx");
    expect(assistant).toContain("```jsx");
    expect(assistant).toContain("import React from 'react'");
    expect(assistant).toContain("export default () => <h1>hi</h1>");
  });

  it("emits a separate file header + fenced code block per file", () => {
    const blocks = buildSeedSectionBlocks({
      chatId: "chat-2",
      promptId: "prompt-2",
      blockId: "block-2",
      streamId: "stream-2",
      userText: "two-file app",
      files: [
        { path: "/App.jsx", lang: "jsx", content: "// app\n" },
        { path: "/Card.jsx", lang: "jsx", content: "// card\n" },
      ],
    });
    const msgs = reconstructConversationMessages(blocks);
    const assistant = firstText(msgs[1]);
    expect(assistant.match(/File: \/App\.jsx/g)?.length).toBe(1);
    expect(assistant.match(/File: \/Card\.jsx/g)?.length).toBe(1);
    expect(assistant.match(/```jsx/g)?.length).toBe(2);
    // App.jsx header lands before its fenced content; Card.jsx after.
    expect(assistant.indexOf("File: /App.jsx")).toBeLessThan(assistant.indexOf("File: /Card.jsx"));
  });

  it("sequence numbers monotonically increase across all emitted messages", () => {
    const blocks = buildSeedSectionBlocks({
      chatId: "chat-3",
      promptId: "prompt-3",
      blockId: "block-3",
      streamId: "stream-3",
      userText: "x",
      files: [{ path: "/A.ts", lang: "ts", content: "const a = 1\nconst b = 2\n" }],
    });
    const seqs = blocks.map((b) => b.seq);
    for (let i = 1; i < seqs.length; i += 1) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    }
  });

  it("frames the assistant turn with prompt.block-begin/-end and a block.begin/end pair", () => {
    const blocks = buildSeedSectionBlocks({
      chatId: "chat-4",
      promptId: "prompt-4",
      blockId: "block-4",
      streamId: "stream-4",
      userText: "frame check",
      files: [{ path: "/x.js", lang: "js", content: "1\n" }],
    });
    expect(blocks[0]?.type).toBe("prompt.block-begin");
    expect(blocks[1]?.type).toBe("prompt.req");
    expect(blocks[2]?.type).toBe("block.begin");
    expect(blocks[blocks.length - 1]?.type).toBe("prompt.block-end");
    expect(blocks[blocks.length - 2]?.type).toBe("block.end");
  });
});
