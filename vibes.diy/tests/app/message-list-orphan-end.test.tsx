import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MessageList from "../../pkg/app/components/MessageList.js";
import type { PromptBlock } from "../../pkg/app/routes/chat/prompt-state.js";

// A reconnect can replay a section's `code.end` onto a fresh block whose
// `code.begin` was on the now-superseded stream (long whole-file generations
// spread a section over ~30s, widening this window). The reducer must skip the
// orphaned end rather than build a Code block with `begin: undefined` and crash
// the render on `block.begin.sectionId`.
const base = { blockId: "b1", streamId: "p1", blockNr: 0, timestamp: new Date() };

describe("MessageList orphan code.end (reconnect convergence guard)", () => {
  it("renders a block whose code.end has no preceding code.begin without crashing", () => {
    const msgs = [
      { type: "block.begin", seq: 0, ...base },
      // No code.begin — it was lost to a reconnect (replayReset on the new stream).
      { type: "block.code.line", sectionId: "s1", lang: "jsx", path: "/App.jsx", line: "const x = 1;", lineNr: 0, seq: 1, ...base },
      { type: "block.code.end", sectionId: "s1", lang: "jsx", path: "/App.jsx", stats: { lines: 1, bytes: 12 }, seq: 2, ...base },
      {
        type: "block.end",
        stats: {
          toplevel: { lines: 0, bytes: 0 },
          code: { lines: 1, bytes: 12 },
          image: { lines: 0, bytes: 0 },
          total: { lines: 1, bytes: 12 },
        },
        usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
        seq: 3,
        ...base,
      },
    ];
    const promptBlocks = [{ msgs } as unknown as PromptBlock];

    const onClick = (): void => undefined;
    expect(() =>
      render(<MessageList promptBlocks={promptBlocks} promptProcessing={false} chatId="c1" onClick={onClick} />)
    ).not.toThrow();
  });
});
