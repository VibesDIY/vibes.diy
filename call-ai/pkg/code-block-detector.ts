/**
 * Code Block Detector - State machine for detecting markdown code fences in streaming text
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
 * State machine for detecting code block boundaries in streaming text.
 *
 * Handles:
 * - Opening fences: ```language
 * - Closing fences: ```
 * - Partial fence detection (buffering)
 * - Language tag extraction
 */
export class CodeBlockDetector {
  private state: State = "TEXT";
  private buffer = "";
  private currentBlock: CodeBlock | null = null;
  private blockCounter = 0;
  private model = "unknown";

  constructor(model = "unknown") {
    this.model = model;
  }

  /**
   * Feed a delta (chunk of text) into the detector
   * @returns Array of StreamMessage events to emit
   *
   * Each call to feed() will emit TEXT_FRAGMENT/CODE_FRAGMENT events
   * for the non-fence content in this delta, enabling true streaming.
   */
  feed(delta: string, streamId: number, seq: number): StreamMessage[] {
    const events: StreamMessage[] = [];

    // Track content to emit - flushed before transitions and at end of delta
    let textToEmit = "";
    let codeToEmit = "";

    // Helper to flush accumulated content before transition events
    const flushContent = () => {
      if (textToEmit.length > 0) {
        events.push(
          createMessage(StreamTypes.TEXT_FRAGMENT, this.model, "client", {
            streamId,
            seq: String(seq),
            frag: textToEmit,
          }),
        );
        textToEmit = "";
      }
      if (codeToEmit.length > 0 && this.currentBlock) {
        events.push(
          createMessage(StreamTypes.CODE_FRAGMENT, this.model, "client", {
            streamId,
            blockId: this.currentBlock.blockId,
            seq: String(seq),
            frag: codeToEmit,
          }),
        );
        codeToEmit = "";
      }
    };

    for (const char of delta) {
      // Process char for state transitions and get any transition events
      const { transitionEvents, emittedText, emittedCode } = this.processCharForDelta(char, streamId, seq);

      // Flush accumulated content BEFORE transition events to maintain order
      if (transitionEvents.length > 0) {
        flushContent();
        events.push(...transitionEvents);
      }

      // Accumulate content to emit
      textToEmit += emittedText;
      codeToEmit += emittedCode;
    }

    // Emit any remaining accumulated content from this delta
    flushContent();

    return events;
  }

  /**
   * Finalize the detector - call when stream ends
   * Flushes any remaining buffered content
   */
  finalize(streamId: number): StreamMessage[] {
    const events: StreamMessage[] = [];

    // Flush any remaining buffer
    if (this.buffer.length > 0) {
      if (this.state === "IN_CODE" || this.state === "MAYBE_CLOSE") {
        // We're in a code block - emit remaining as code fragment
        const block = this.currentBlock;
        if (block) {
          events.push(
            createMessage(StreamTypes.CODE_FRAGMENT, this.model, "client", {
              streamId,
              blockId: block.blockId,
              seq: "final",
              frag: this.buffer,
            }),
          );
        }
      } else {
        // We're in text - emit remaining as text fragment
        events.push(
          createMessage(StreamTypes.TEXT_FRAGMENT, this.model, "client", {
            streamId,
            seq: "final",
            frag: this.buffer,
          }),
        );
      }
      this.buffer = "";
    }

    // If we're in a code block, emit CODE_END
    if (this.currentBlock) {
      events.push(
        createMessage(StreamTypes.CODE_END, this.model, "client", {
          streamId,
          blockId: this.currentBlock.blockId,
          language: this.currentBlock.language,
        }),
      );
      this.currentBlock = null;
    }

    this.state = "TEXT";
    return events;
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.state = "TEXT";
    this.buffer = "";
    this.currentBlock = null;
    this.blockCounter = 0;
  }

  /**
   * Process a single character for per-delta emission.
   * Returns transition events (CODE_START, CODE_END) and content to emit.
   * Content is accumulated by feed() and emitted at end of delta.
   */
  private processCharForDelta(
    char: string,
    streamId: number,
    seq: number,
  ): { transitionEvents: StreamMessage[]; emittedText: string; emittedCode: string } {
    const transitionEvents: StreamMessage[] = [];
    let emittedText = "";
    let emittedCode = "";

    switch (this.state) {
      case "TEXT":
        if (char === "`") {
          // Start tracking potential fence - buffer backticks
          this.buffer += char;
          if (this.buffer.endsWith("```")) {
            // We have a complete opening fence marker
            // Any text before the fence was already emitted per-char
            this.buffer = "```";
            this.state = "MAYBE_FENCE";
          }
        } else {
          // Non-backtick in TEXT state - emit as text
          // But first, flush any partial backticks as text (they weren't a fence)
          if (this.buffer.length > 0) {
            emittedText += this.buffer;
            this.buffer = "";
          }
          emittedText += char;
        }
        break;

      case "MAYBE_FENCE":
        if (char === "\n") {
          // Fence confirmed - extract language
          const fenceContent = this.buffer.slice(3); // Remove ```
          const language = fenceContent.trim() || undefined;

          // Start new code block
          this.blockCounter++;
          const blockId = nextId("block");
          this.currentBlock = {
            blockId,
            language,
            startSeq: String(seq),
          };

          transitionEvents.push(
            createMessage(StreamTypes.CODE_START, this.model, "client", {
              streamId,
              blockId,
              language,
              seq: String(seq),
            }),
          );

          this.buffer = "";
          this.state = "IN_CODE";
        } else if (char === "`") {
          // More backticks - could be ````
          this.buffer += char;
        } else {
          // Language identifier character
          this.buffer += char;
        }
        break;

      case "IN_CODE":
        if (char === "`") {
          this.buffer += char;
          if (this.buffer.endsWith("```")) {
            // Potential closing fence
            this.state = "MAYBE_CLOSE";
          }
        } else {
          // Non-backtick in IN_CODE state - emit as code
          // But first, flush any partial backticks as code (they weren't a fence)
          if (this.buffer.length > 0) {
            emittedCode += this.buffer;
            this.buffer = "";
          }
          emittedCode += char;
        }
        break;

      case "MAYBE_CLOSE":
        if (char === "\n" || char === " " || char === "\t") {
          // Closing fence confirmed
          // Any code before the fence (excluding the ```) was already emitted per-char
          // The buffer contains ```  which we discard
          const block = this.currentBlock;

          if (block) {
            transitionEvents.push(
              createMessage(StreamTypes.CODE_END, this.model, "client", {
                streamId,
                blockId: block.blockId,
                language: block.language,
              }),
            );
          }

          this.currentBlock = null;
          this.buffer = "";
          this.state = "TEXT";
          // The newline/space after closing fence goes to text
          if (char !== "\n") {
            emittedText += char;
          }
        } else if (char === "`") {
          // More backticks - could be ```` inside code
          this.buffer += char;
        } else {
          // False alarm - the ``` was inside code, emit it plus this char
          emittedCode += this.buffer + char;
          this.buffer = "";
          this.state = "IN_CODE";
        }
        break;
    }

    return { transitionEvents, emittedText, emittedCode };
  }
}
