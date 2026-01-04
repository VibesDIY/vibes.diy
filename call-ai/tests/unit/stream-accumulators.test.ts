import { describe, it, expect } from "vitest";
import {
  createAccumulatorState,
  accumulateIncremental,
  accumulateCodeBlocks,
  accumulateText,
} from "../../pkg/stream-accumulators.js";
import { createMessage, StreamTypes, StreamMessage } from "../../pkg/stream-messages.js";

// Helper to create test messages
function codeStart(blockId: string, language?: string): StreamMessage {
  return createMessage(StreamTypes.CODE_START, "test", "client", { blockId, language, streamId: 1, seq: "0" });
}

function codeFrag(blockId: string, frag: string, seq = "1"): StreamMessage {
  return createMessage(StreamTypes.CODE_FRAGMENT, "test", "client", { blockId, frag, streamId: 1, seq });
}

function codeEnd(blockId: string): StreamMessage {
  return createMessage(StreamTypes.CODE_END, "test", "client", { blockId, streamId: 1 });
}

function textFrag(frag: string, seq = "0"): StreamMessage {
  return createMessage(StreamTypes.TEXT_FRAGMENT, "test", "client", { frag, streamId: 1, seq });
}

describe("accumulateCodeBlocks", () => {
  it("accumulates single complete block", () => {
    const messages: StreamMessage[] = [
      codeStart("block-1", "javascript"),
      codeFrag("block-1", "const x = 1;"),
      codeFrag("block-1", "\nconst y = 2;"),
      codeEnd("block-1"),
    ];

    const blocks = accumulateCodeBlocks(messages);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      blockId: "block-1",
      language: "javascript",
      content: "const x = 1;\nconst y = 2;",
      complete: true,
    });
  });

  it("accumulates multiple blocks", () => {
    const messages: StreamMessage[] = [
      codeStart("block-1", "js"),
      codeFrag("block-1", "console.log('first');"),
      codeEnd("block-1"),
      codeStart("block-2", "py"),
      codeFrag("block-2", "print('second')"),
      codeEnd("block-2"),
    ];

    const blocks = accumulateCodeBlocks(messages);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({
      blockId: "block-1",
      language: "js",
      content: "console.log('first');",
      complete: true,
    });
    expect(blocks[1]).toMatchObject({
      blockId: "block-2",
      language: "py",
      content: "print('second')",
      complete: true,
    });
  });

  it("handles in-progress block (no CODE_END)", () => {
    const messages: StreamMessage[] = [codeStart("block-1", "ts"), codeFrag("block-1", "const partial = ")];

    const blocks = accumulateCodeBlocks(messages);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      blockId: "block-1",
      language: "ts",
      content: "const partial = ",
      complete: false, // Key assertion - block is NOT complete
    });
  });

  it("handles block without language", () => {
    const messages: StreamMessage[] = [
      codeStart("block-1"), // No language
      codeFrag("block-1", "plain code"),
      codeEnd("block-1"),
    ];

    const blocks = accumulateCodeBlocks(messages);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBeUndefined();
    expect(blocks[0].content).toBe("plain code");
  });

  it("ignores text fragments", () => {
    const messages: StreamMessage[] = [
      textFrag("Some text before"),
      codeStart("block-1", "js"),
      codeFrag("block-1", "code();"),
      codeEnd("block-1"),
      textFrag("Some text after"),
    ];

    const blocks = accumulateCodeBlocks(messages);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].content).toBe("code();");
  });
});

describe("accumulateIncremental", () => {
  it("processes messages incrementally", () => {
    const messages: StreamMessage[] = [];
    let state = createAccumulatorState();

    // Add CODE_START
    messages.push(codeStart("block-1", "js"));
    state = accumulateIncremental(messages, state);
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0].complete).toBe(false);
    expect(state.nextIndex).toBe(1);

    // Add CODE_FRAGMENT
    messages.push(codeFrag("block-1", "line 1\n"));
    state = accumulateIncremental(messages, state);
    expect(state.blocks[0].content).toBe("line 1\n");
    expect(state.nextIndex).toBe(2);

    // Add another CODE_FRAGMENT
    messages.push(codeFrag("block-1", "line 2\n"));
    state = accumulateIncremental(messages, state);
    expect(state.blocks[0].content).toBe("line 1\nline 2\n");
    expect(state.nextIndex).toBe(3);

    // Add CODE_END
    messages.push(codeEnd("block-1"));
    state = accumulateIncremental(messages, state);
    expect(state.blocks[0].complete).toBe(true);
    expect(state.nextIndex).toBe(4);
  });

  it("accumulates text incrementally", () => {
    const messages: StreamMessage[] = [];
    let state = createAccumulatorState();

    messages.push(textFrag("Hello "));
    state = accumulateIncremental(messages, state);
    expect(state.text).toBe("Hello ");

    messages.push(textFrag("world!"));
    state = accumulateIncremental(messages, state);
    expect(state.text).toBe("Hello world!");
  });

  it("handles interleaved text and code", () => {
    const messages: StreamMessage[] = [];
    let state = createAccumulatorState();

    messages.push(textFrag("Here's code:\n"));
    messages.push(codeStart("b1", "js"));
    messages.push(codeFrag("b1", "x = 1"));
    messages.push(codeEnd("b1"));
    messages.push(textFrag("\nDone!"));

    state = accumulateIncremental(messages, state);

    expect(state.text).toBe("Here's code:\n\nDone!");
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0].content).toBe("x = 1");
    expect(state.blocks[0].complete).toBe(true);
  });

  it("does not mutate previous state", () => {
    const messages: StreamMessage[] = [codeStart("b1", "js")];
    const state1 = accumulateIncremental(messages, createAccumulatorState());

    messages.push(codeFrag("b1", "code"));
    const state2 = accumulateIncremental(messages, state1);

    // state1 should be unchanged
    expect(state1.blocks[0].content).toBe("");
    expect(state2.blocks[0].content).toBe("code");
  });
});

describe("accumulateText", () => {
  it("concatenates text fragments", () => {
    const messages: StreamMessage[] = [textFrag("Hello "), textFrag("world"), textFrag("!")];

    const text = accumulateText(messages);
    expect(text).toBe("Hello world!");
  });

  it("includes code fragments in text", () => {
    const messages: StreamMessage[] = [
      textFrag("Text before "),
      codeStart("b1", "js"),
      codeFrag("b1", "const x = 1;"),
      codeEnd("b1"),
      textFrag(" text after"),
    ];

    const text = accumulateText(messages);
    expect(text).toBe("Text before const x = 1; text after");
  });

  it("returns empty string for no text messages", () => {
    const messages: StreamMessage[] = [codeStart("b1", "js"), codeEnd("b1")];

    const text = accumulateText(messages);
    expect(text).toBe("");
  });
});
