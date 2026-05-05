import { describe, expect, it } from "vitest";
import { createStreamingResolver, resolveCodeBlocksToFileSystem, type ApplyErrorEvent } from "@vibes.diy/api-svc";
import type { CodeBeginMsg, CodeLineMsg, CodeEndMsg } from "@vibes.diy/call-ai-v2";
import type { VibeFile } from "@vibes.diy/api-types";

const ts = new Date("2026-05-04T00:00:00Z");

interface BuiltBlock {
  begin: CodeBeginMsg;
  lines: CodeLineMsg[];
  end: CodeEndMsg;
}

function makeBlock(blockId: string, lines: string[], path = "App.jsx"): BuiltBlock {
  const sectionId = `sec-${blockId}`;
  return {
    begin: {
      type: "block.code.begin",
      blockId,
      blockNr: 1,
      streamId: "stream",
      seq: 1,
      timestamp: ts,
      sectionId,
      lang: "jsx",
      path,
    },
    lines: lines.map((line, i) => ({
      type: "block.code.line",
      blockId,
      blockNr: 1,
      streamId: "stream",
      seq: 2,
      timestamp: ts,
      sectionId,
      lang: "jsx",
      path,
      line,
      lineNr: i + 1,
    })),
    end: {
      type: "block.code.end",
      blockId,
      blockNr: 1,
      streamId: "stream",
      seq: 3,
      timestamp: ts,
      sectionId,
      lang: "jsx",
      path,
      stats: { lines: lines.length, bytes: lines.join("\n").length },
    },
  };
}

function contentOf(f: VibeFile): string {
  if (f.type !== "code-block") throw new Error(`expected code-block, got ${f.type}`);
  return f.content;
}

describe("createStreamingResolver — per-block apply-error observation", () => {
  it("good/bad/good turn surfaces exactly one apply error and end-of-turn output matches the legacy resolver", () => {
    // Seed the chat with prior content so SEARCH/REPLACE blocks have something to match.
    const seed = new Map<string, string>([
      ["/App.jsx", ["export default function App() {", "  return <h1>ALPHA</h1>;", "}"].join("\n")],
    ]);

    const goodA = makeBlock("blk-1", [
      "<<<<<<< SEARCH",
      "  return <h1>ALPHA</h1>;",
      "=======",
      "  return <h1>BETA</h1>;",
      ">>>>>>> REPLACE",
    ]);
    // Bad block: SEARCH text never appears in current vfs content, so applyEdits
    // emits a no-match apply error.
    const badNoMatch = makeBlock("blk-2", [
      "<<<<<<< SEARCH",
      "this text does not exist in the file",
      "=======",
      "replacement does not matter",
      ">>>>>>> REPLACE",
    ]);
    const goodB = makeBlock("blk-3", [
      "<<<<<<< SEARCH",
      "  return <h1>BETA</h1>;",
      "=======",
      "  return <h1>GAMMA</h1>;",
      ">>>>>>> REPLACE",
    ]);

    const errors: ApplyErrorEvent[] = [];
    const resolver = createStreamingResolver({
      chatId: "chat-test",
      promptId: "prompt-test",
      seed,
      onApplyError: (evt) => errors.push(evt),
    });

    // Feed blocks in order, exactly as handleLlmResponse does.
    resolver.observeBlock(goodA);
    resolver.observeBlock(badNoMatch);
    resolver.observeBlock(goodB);

    // Exactly one apply error fired — for the bad block only.
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      chatId: "chat-test",
      promptId: "prompt-test",
      blockId: "blk-2",
      sectionId: "sec-blk-2",
      kind: "apply",
      reason: "no-match",
    });
    expect(errors[0].searchPrefix).toBe("this text does not exist in the file");

    // End-of-turn VibeFile[] is identical to current behavior (legacy resolver path).
    const endOfTurn = resolveCodeBlocksToFileSystem([goodA, badNoMatch, goodB], seed);
    expect(endOfTurn).toHaveLength(1);
    expect(endOfTurn[0].filename).toBe("/App.jsx");
    // The bad block produces no edit, so GAMMA wins after the third block.
    expect(contentOf(endOfTurn[0])).toContain("<h1>GAMMA</h1>");
    expect(contentOf(endOfTurn[0])).not.toContain("<h1>ALPHA</h1>");
    expect(contentOf(endOfTurn[0])).not.toContain("<<<<<<< SEARCH");
  });

  it("create-only block (no SEARCH markers) does not fire apply errors", () => {
    const seed = new Map<string, string>();
    const errors: ApplyErrorEvent[] = [];
    const resolver = createStreamingResolver({
      chatId: "chat-test",
      promptId: "prompt-test",
      seed,
      onApplyError: (evt) => errors.push(evt),
    });
    const create = makeBlock("blk-c", ["export default function App() { return <h1>fresh</h1>; }"]);
    resolver.observeBlock(create);
    expect(errors).toHaveLength(0);
  });

  it("structured fields include chatId, promptId, blockId, sectionId, kind, reason", () => {
    const seed = new Map<string, string>([["/App.jsx", "hello world"]]);
    const errors: ApplyErrorEvent[] = [];
    const resolver = createStreamingResolver({
      chatId: "C-1",
      promptId: "P-1",
      seed,
      onApplyError: (evt) => errors.push(evt),
    });
    const bad = makeBlock("B-1", ["<<<<<<< SEARCH", "nope", "=======", "yep", ">>>>>>> REPLACE"]);
    resolver.observeBlock(bad);
    expect(errors).toHaveLength(1);
    const evt = errors[0];
    expect(evt.chatId).toBe("C-1");
    expect(evt.promptId).toBe("P-1");
    expect(evt.blockId).toBe("B-1");
    expect(evt.sectionId).toBe("sec-B-1");
    expect(evt.kind).toBe("apply");
    expect(evt.reason).toBe("no-match");
  });
});
