/**
 * Code block handler - Detects markdown code fences in streaming text.
 *
 * Listens to or.delta events and emits structured events for text/code transitions.
 * Replaces CodeBlockParser.
 */

import { ParserHandler, OrDelta, TextFragment, CodeStart, CodeFragment, CodeEnd } from "../parser-evento.js";

type State = "TEXT" | "MAYBE_FENCE" | "IN_CODE" | "MAYBE_CLOSE";

/**
 * Creates a new instance of the code block handler with its own state.
 */
export function createCodeBlockHandler(): ParserHandler {
  let state: State = "TEXT";
  let buffer = "";
  let currentBlockId: string | null = null;
  let currentLanguage: string | undefined = undefined;
  let seq = 0;
  let blockIdCounter = 0;

  // Track content to emit - flushed before transitions and at end of delta
  let textToEmit = "";
  let codeToEmit = "";

  function nextBlockId(): string {
    return `block-${++blockIdCounter}`;
  }

  function emitText(fragment: string, emit: (evt: TextFragment) => void): void {
    if (fragment.length === 0) return;
    emit({
      type: "text.fragment",
      seq: seq++,
      fragment,
    });
  }

  function emitCodeStart(blockId: string, language: string | undefined, emit: (evt: CodeStart) => void): void {
    emit({
      type: "code.start",
      seq: seq++,
      blockId,
      language,
    });
  }

  function emitCodeFragment(blockId: string, fragment: string, emit: (evt: CodeFragment) => void): void {
    if (fragment.length === 0) return;
    emit({
      type: "code.fragment",
      seq: seq++,
      blockId,
      fragment,
    });
  }

  function emitCodeEnd(blockId: string, emit: (evt: CodeEnd) => void): void {
    emit({
      type: "code.end",
      seq: seq++,
      blockId,
    });
  }

  function flushContent(emit: (evt: any) => void): void {
    if (textToEmit.length > 0) {
      emitText(textToEmit, emit);
      textToEmit = "";
    }
    if (codeToEmit.length > 0 && currentBlockId) {
      emitCodeFragment(currentBlockId, codeToEmit, emit);
      codeToEmit = "";
    }
  }

  function finalize(emit: (evt: any) => void): void {
    // Flush remaining buffer
    if (buffer.length > 0) {
      if (state === "MAYBE_CLOSE") {
        // Buffer contains closing fence (```), discard it - it's not content
        buffer = "";
      } else if (state === "IN_CODE") {
        codeToEmit += buffer;
        buffer = "";
      } else {
        textToEmit += buffer;
        buffer = "";
      }
    }
    flushContent(emit);

    // Close incomplete block
    if (currentBlockId) {
      emitCodeEnd(currentBlockId, emit);
      currentBlockId = null;
    }
  }

  return {
    hash: "code-block-detector",
    validate: (event) => {
      if (event.type === "or.delta" || event.type === "or.stream-end") {
        return { some: event };
      }
      return { none: true };
    },
    handle: (ctx) => {
      if (ctx.event.type === "or.stream-end") {
        finalize(ctx.emit);
        return;
      }

      const evt = ctx.event as OrDelta;
      for (const char of evt.content) {
        switch (state) {
          case "TEXT":
            if (char === "`") {
              buffer += char;
              if (buffer === "```") {
                // Complete opening fence detected
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
              // Fence confirmed - extract language
              const fenceContent = buffer.slice(3); // Remove ```
              const language = fenceContent.trim() || undefined;

              // Flush pending text before starting code block
              flushContent(ctx.emit);

              // Start new code block
              currentBlockId = nextBlockId();
              currentLanguage = language;
              emitCodeStart(currentBlockId, language, ctx.emit);

              buffer = "";
              state = "IN_CODE";
            } else {
              // Accumulate language tag (e.g., ```jsx)
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
            if (char === "\n") {
              // Closing fence confirmed
              flushContent(ctx.emit);

              if (currentBlockId) {
                emitCodeEnd(currentBlockId, ctx.emit);
              }

              currentBlockId = null;
              currentLanguage = undefined;
              buffer = "";
              state = "TEXT";
            } else if (char === " " || char === "\t" || char === "\r") {
              // Trailing whitespace or \r (from CRLF) - valid after closing fence
              // Accumulate in buffer in case this turns out to be a false alarm
              buffer += char;
            } else {
              // Not a newline or whitespace - false alarm, emit buffer + char as code
              codeToEmit += buffer + char;
              buffer = "";
              state = "IN_CODE";
            }
            break;
        }
      }

      // Flush content at end of delta
      flushContent(ctx.emit);
    },
  };
}
