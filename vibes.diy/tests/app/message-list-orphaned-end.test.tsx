import React from "react";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import MessageList from "~/vibes.diy/app/components/MessageList.js";
import type { PromptBlock } from "~/vibes.diy/app/routes/chat/prompt-state.js";

// Regression coverage for VibesDIY/vibes.diy#2652: a reconnect can replay a
// section's end frame whose matching begin lived on a now-superseded stream.
// The live render must drop the orphaned end rather than build a block with no
// opening frame and throw on `begin.sectionId`.

const base = (over: Record<string, unknown>) => ({
  blockId: "b1",
  streamId: "stream-1",
  seq: 0,
  blockNr: 1,
  timestamp: new Date(),
  ...over,
});

const codeBegin = (sectionId: string) => base({ type: "block.code.begin", sectionId, lang: "tsx", path: "App.jsx" });
const codeLine = (sectionId: string, line: string, lineNr: number) =>
  base({ type: "block.code.line", sectionId, lang: "tsx", path: "App.jsx", lineNr, line });
const toplevelBegin = (sectionId: string) => base({ type: "block.toplevel.begin", sectionId });
const toplevelLine = (sectionId: string, line: string, lineNr: number) =>
  base({ type: "block.toplevel.line", sectionId, lineNr, line });
const codeEnd = (sectionId: string) =>
  base({ type: "block.code.end", sectionId, lang: "tsx", path: "App.jsx", stats: { lines: 1, bytes: 42 } });
const toplevelEnd = (sectionId: string) => base({ type: "block.toplevel.end", sectionId, stats: { lines: 1, bytes: 10 } });
const blockBegin = () => base({ type: "block.begin" });
const stat = { lines: 1, bytes: 1 };
const blockEnd = () =>
  base({
    type: "block.end",
    stats: { toplevel: stat, code: stat, image: stat, total: stat },
    usage: {
      given: [{ prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }],
      calculated: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
    fsRef: { appSlug: "app", ownerHandle: "owner", mode: "dev", fsId: "fs-1" },
  });

const asBlocks = (msgs: unknown[]): PromptBlock[] => [{ msgs } as unknown as PromptBlock];

const renderList = (blocks: PromptBlock[]) =>
  render(<MessageList promptBlocks={blocks} promptProcessing={false} chatId="chat-1" onClick={() => undefined} />);

describe("MessageList orphaned section-end handling (#2652)", () => {
  afterEach(() => cleanup());

  it("drops a code.end with no matching code.begin and keeps rendering the rest", () => {
    const blocks = asBlocks([
      blockBegin(),
      // The orphaned end arrives first, with no open begin — its matching begin
      // lived on the now-superseded stream. Pre-fix this builds a block with an
      // undefined begin and throws on `begin.sectionId`.
      codeEnd("section-orphan"),
      // A well-formed code section that must still render.
      codeBegin("section-good"),
      codeLine("section-good", "export default function App() { return null; }", 0),
      codeEnd("section-good"),
      blockEnd(),
    ]);

    const { container } = renderList(blocks);

    // The good section renders; the orphaned one is skipped, not crashed on.
    expect(container.querySelector('[data-section-id="section-good"]')).not.toBeNull();
    expect(container.querySelector('[data-section-id="section-orphan"]')).toBeNull();
  });

  it("drops a toplevel.end with no matching toplevel.begin without throwing", () => {
    const blocks = asBlocks([blockBegin(), toplevelEnd("section-orphan"), blockEnd()]);

    expect(() => renderList(blocks)).not.toThrow();
  });

  it("does not swallow an open section's buffered lines when dropping an orphan", () => {
    // Code and toplevel lines share one buffer. An orphan code.end arriving
    // while a toplevel section is mid-stream must not consume that section's
    // already-buffered lines (Codex review on #2958).
    const blocks = asBlocks([
      blockBegin(),
      toplevelBegin("section-tl"),
      toplevelLine("section-tl", "alphaword", 0),
      // Orphan end for a section whose begin was lost on the superseded stream.
      codeEnd("section-orphan"),
      toplevelLine("section-tl", "betaword", 1),
      toplevelEnd("section-tl"),
      blockEnd(),
    ]);

    const { container } = renderList(blocks);
    const tl = container.querySelector('[data-section-id="section-tl"]');
    expect(tl).not.toBeNull();
    // Both the pre-orphan and post-orphan lines survive.
    expect(tl?.textContent).toContain("alphaword");
    expect(tl?.textContent).toContain("betaword");
  });
});
