/**
 * Code Block Detector - Generator for detecting markdown code fences in streaming text
 *
 * This module detects ``` fenced code blocks in streaming text and emits
 * semantic events (CODE_START, CODE_FRAGMENT, CODE_END, TEXT_FRAGMENT).
 */

import { StreamMessage, StreamTypes, createMessage, nextId } from "./stream-messages.js";

type State = "TEXT" | "MAYBE_FENCE" | "IN_CODE" | "MAYBE_CLOSE";

interface CodeBlock {
  blockId: string;
  language?: string;
  startSeq: string;
}

/**
 * Generator that consumes a stream of text chunks and emits semantic StreamMessages.
 * Implements the SubStream pattern (chainable generator).
 *
 * @param input AsyncIterable of text chunks (deltas)
 * @param streamId The ID of the stream
 * @param model Optional model name for metadata
 */
export async function* detectCodeBlocks(
  input: AsyncIterable<string>,
  streamId: number,
  model = "unknown",
): AsyncGenerator<StreamMessage, void, unknown> {
  let state: State = "TEXT";
  let buffer = "";
  let currentBlock: CodeBlock | null = null;
  let seqCounter = 0;

  // Track content to emit - flushed before transitions and at end of delta
  let textToEmit = "";
  let codeToEmit = "";

  // Helper to yield accumulated content
  function* yieldContent(): Generator<StreamMessage, void, unknown> {
    if (textToEmit.length > 0) {
      yield createMessage(StreamTypes.TEXT_FRAGMENT, model, "client", {
        streamId,
        seq: String(seqCounter++),
        frag: textToEmit,
      });
      textToEmit = "";
    }
    if (codeToEmit.length > 0 && currentBlock) {
      yield createMessage(StreamTypes.CODE_FRAGMENT, model, "client", {
        streamId,
        blockId: currentBlock.blockId,
        seq: String(seqCounter++),
        frag: codeToEmit,
      });
      codeToEmit = "";
    }
  }

  for await (const delta of input) {
    for (const char of delta) {
      // State machine logic
      switch (state) {
        case "TEXT":
          if (char === "`") {
            buffer += char;
            if (buffer === "```") {
              // Complete opening fence
              buffer = "```"; // Keep fence marker in buffer for transition
              state = "MAYBE_FENCE";
            }
          } else {
            // Not a backtick - flush any partial backticks as text
            if (buffer.length > 0) {
              textToEmit += buffer;
              buffer = "";
            }
            textToEmit += char;
          }
          break;

        case "MAYBE_FENCE":
          if (char === "\n") {
            // Fence confirmed
            const fenceContent = buffer.slice(3); // Remove ```
            const language = fenceContent.trim() || undefined;

            // Flush pending text before starting code block
            yield* yieldContent();

            // Start new code block
            const blockId = nextId("block");
            currentBlock = {
              blockId,
              language,
              startSeq: String(seqCounter++),
            };

            yield createMessage(StreamTypes.CODE_START, model, "client", {
              streamId,
              blockId,
              language,
              seq: String(seqCounter), // Note: using seq from startSeq logic or just current? usage suggests unique seq per event
            });

            buffer = "";
            state = "IN_CODE";
          } else if (char === "`") {
            buffer += char;
          } else {
            buffer += char;
          }
          break;

        case "IN_CODE":
          if (char === "`") {
            buffer += char;
            if (buffer === "```") {
              state = "MAYBE_CLOSE";
            }
          } else {
            // Not a backtick - flush any partial backticks as code
            if (buffer.length > 0) {
              codeToEmit += buffer;
              buffer = "";
            }
            codeToEmit += char;
          }
          break;

        case "MAYBE_CLOSE":
          if (char === "\n" || char === " " || char === "\t") {
            // Closing fence confirmed
            // Flush pending code before ending block
            yield* yieldContent();

            if (currentBlock) {
              yield createMessage(StreamTypes.CODE_END, model, "client", {
                streamId,
                blockId: currentBlock.blockId,
                language: currentBlock.language,
              });
            }

            currentBlock = null;
            buffer = "";
            state = "TEXT";
            if (char !== "\n") {
              textToEmit += char;
            }
          } else if (char === "`") {
            buffer += char;
          } else {
            // False alarm - emit buffer + char as code
            codeToEmit += buffer + char;
            buffer = "";
            state = "IN_CODE";
          }
          break;
      }
    }

    // Flush content at end of delta
    yield* yieldContent();
  }

  // Finalize
  // Flush remaining buffer
  if (buffer.length > 0) {
    if (state === "IN_CODE" || state === "MAYBE_CLOSE") {
      codeToEmit += buffer;
    } else {
      textToEmit += buffer;
    }
    buffer = "";
  }
  yield* yieldContent();

  // Close incomplete block
  if (currentBlock) {
    yield createMessage(StreamTypes.CODE_END, model, "client", {
      streamId,
      blockId: currentBlock.blockId,
      language: currentBlock.language,
    });
  }
}
