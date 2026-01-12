import { OnFunc } from "@adviser/cement";

import { OpenRouterParser, OpenRouterDeltaEvent } from "./openrouter-parser.js";

/**
 * TextFragmentEvent - Text content outside code blocks
 */
export interface TextFragmentEvent {
  readonly type: "textFragment";
  readonly seq: number;
  readonly fragment: string;
}

/**
 * CodeStartEvent - Beginning of a fenced code block
 */
export interface CodeStartEvent {
  readonly type: "codeStart";
  readonly seq: number;
  readonly blockId: string;
  readonly language?: string;
}

/**
 * CodeFragmentEvent - Content inside a code block
 */
export interface CodeFragmentEvent {
  readonly type: "codeFragment";
  readonly seq: number;
  readonly blockId: string;
  readonly fragment: string;
}

/**
 * CodeEndEvent - End of a fenced code block
 */
export interface CodeEndEvent {
  readonly type: "codeEnd";
  readonly seq: number;
  readonly blockId: string;
}

export type CodeBlockEvent = TextFragmentEvent | CodeStartEvent | CodeFragmentEvent | CodeEndEvent;

type State = "TEXT" | "MAYBE_FENCE" | "IN_CODE" | "MAYBE_CLOSE";

let blockIdCounter = 0;

function nextBlockId(): string {
  return `block-${++blockIdCounter}`;
}

/**
 * CodeBlockParser - Detects markdown code fences in streaming text.
 *
 * This class listens to OpenRouterParser delta events and detects
 * ``` fenced code blocks, emitting structured events for text/code transitions.
 *
 * Usage:
 * ```typescript
 * const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
 * const sseParser = new SSEDataParser(lineParser);
 * const jsonParser = new JsonParser(sseParser);
 * const orParser = new OpenRouterParser(jsonParser);
 * const codeParser = new CodeBlockParser(orParser);
 *
 * codeParser.onTextFragment(evt => console.log("Text:", evt.fragment));
 * codeParser.onCodeStart(evt => console.log("Code block:", evt.language));
 * codeParser.onCodeFragment(evt => console.log("Code:", evt.fragment));
 * codeParser.onCodeEnd(evt => console.log("End block"));
 *
 * for await (const chunk of response.body) {
 *   codeParser.processChunk(chunk);
 * }
 * ```
 */
export class CodeBlockParser {
  readonly onTextFragment = OnFunc<(event: TextFragmentEvent) => void>();
  readonly onCodeStart = OnFunc<(event: CodeStartEvent) => void>();
  readonly onCodeFragment = OnFunc<(event: CodeFragmentEvent) => void>();
  readonly onCodeEnd = OnFunc<(event: CodeEndEvent) => void>();
  readonly onEvent = OnFunc<(event: CodeBlockEvent) => void>();

  private readonly orParser: OpenRouterParser;
  private state: State = "TEXT";
  private buffer = "";
  private currentBlockId: string | null = null;
  private currentLanguage: string | undefined = undefined;
  private seq = 0;

  // Track content to emit - flushed before transitions and at end of delta
  private textToEmit = "";
  private codeToEmit = "";

  constructor(orParser: OpenRouterParser) {
    this.orParser = orParser;
    this.orParser.onDelta(this.handleDelta.bind(this));
    this.orParser.onStreamEnd(() => this.finalize());
  }

  private emitText(fragment: string): void {
    if (fragment.length === 0) return;
    const event: TextFragmentEvent = {
      type: "textFragment",
      seq: this.seq++,
      fragment,
    };
    this.onTextFragment.invoke(event);
    this.onEvent.invoke(event);
  }

  private emitCodeStart(blockId: string, language?: string): void {
    const event: CodeStartEvent = {
      type: "codeStart",
      seq: this.seq++,
      blockId,
      language,
    };
    this.onCodeStart.invoke(event);
    this.onEvent.invoke(event);
  }

  private emitCodeFragment(blockId: string, fragment: string): void {
    if (fragment.length === 0) return;
    const event: CodeFragmentEvent = {
      type: "codeFragment",
      seq: this.seq++,
      blockId,
      fragment,
    };
    this.onCodeFragment.invoke(event);
    this.onEvent.invoke(event);
  }

  private emitCodeEnd(blockId: string): void {
    const event: CodeEndEvent = {
      type: "codeEnd",
      seq: this.seq++,
      blockId,
    };
    this.onCodeEnd.invoke(event);
    this.onEvent.invoke(event);
  }

  private flushContent(): void {
    if (this.textToEmit.length > 0) {
      this.emitText(this.textToEmit);
      this.textToEmit = "";
    }
    if (this.codeToEmit.length > 0 && this.currentBlockId) {
      this.emitCodeFragment(this.currentBlockId, this.codeToEmit);
      this.codeToEmit = "";
    }
  }

  private handleDelta(evt: OpenRouterDeltaEvent): void {
    for (const char of evt.content) {
      switch (this.state) {
        case "TEXT":
          if (char === "`") {
            this.buffer += char;
            if (this.buffer === "```") {
              // Complete opening fence detected
              this.state = "MAYBE_FENCE";
            }
          } else {
            // Not a backtick - flush any partial backticks as text
            if (this.buffer.length > 0) {
              this.textToEmit += this.buffer;
              this.buffer = "";
            }
            this.textToEmit += char;
          }
          break;

        case "MAYBE_FENCE":
          if (char === "\n") {
            // Fence confirmed - extract language
            const fenceContent = this.buffer.slice(3); // Remove ```
            const language = fenceContent.trim() || undefined;

            // Flush pending text before starting code block
            this.flushContent();

            // Start new code block
            this.currentBlockId = nextBlockId();
            this.currentLanguage = language;
            this.emitCodeStart(this.currentBlockId, language);

            this.buffer = "";
            this.state = "IN_CODE";
          } else {
            // Accumulate language tag (e.g., ```jsx)
            this.buffer += char;
          }
          break;

        case "IN_CODE":
          if (char === "`") {
            this.buffer += char;
            if (this.buffer === "```") {
              this.state = "MAYBE_CLOSE";
            }
          } else {
            // Not a backtick - flush any partial backticks as code
            if (this.buffer.length > 0) {
              this.codeToEmit += this.buffer;
              this.buffer = "";
            }
            this.codeToEmit += char;
          }
          break;

        case "MAYBE_CLOSE":
          if (char === "\n") {
            // Closing fence confirmed
            this.flushContent();

            if (this.currentBlockId) {
              this.emitCodeEnd(this.currentBlockId);
            }

            this.currentBlockId = null;
            this.currentLanguage = undefined;
            this.buffer = "";
            this.state = "TEXT";
          } else {
            // Not a newline - false alarm, emit buffer + char as code
            this.codeToEmit += this.buffer + char;
            this.buffer = "";
            this.state = "IN_CODE";
          }
          break;
      }
    }

    // Flush content at end of delta
    this.flushContent();
  }

  /**
   * Finalize parsing - call when stream ends to close any open blocks
   */
  finalize(): void {
    // Flush remaining buffer
    if (this.buffer.length > 0) {
      if (this.state === "MAYBE_CLOSE") {
        // Buffer contains closing fence (```), discard it - it's not content
        this.buffer = "";
      } else if (this.state === "IN_CODE") {
        this.codeToEmit += this.buffer;
        this.buffer = "";
      } else {
        this.textToEmit += this.buffer;
        this.buffer = "";
      }
    }
    this.flushContent();

    // Close incomplete block
    if (this.currentBlockId) {
      this.emitCodeEnd(this.currentBlockId);
      this.currentBlockId = null;
    }
  }

  processChunk(chunk: string): void {
    this.orParser.processChunk(chunk);
  }
}
