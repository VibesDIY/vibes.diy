import { ParserEventSource, ParserEvent } from "./parser-evento.js";

/**
 * Segment - A block of content (markdown or code)
 * Matches the shape used by @vibes.diy/prompts
 */
export interface Segment {
  type: "markdown" | "code";
  content: string;
}

/**
 * SegmentAccumulator - Builds growing Segment[] from parser events.
 *
 * This class listens to code block events (text.fragment, code.start, etc.)
 * from a ParserEventSource and accumulates them into a segments array
 * that grows as content streams in.
 *
 * Usage:
 * ```typescript
 * const parser = new OpenRouterParser();
 * parser.register(createCodeBlockHandler());
 * const accumulator = new SegmentAccumulator(parser);
 *
 * // Feed chunks from network
 * for await (const chunk of response.body) {
 *   parser.processChunk(chunk);
 *   // accumulator.segments grows as content arrives
 *   render(accumulator.segments);
 * }
 * ```
 */
export class SegmentAccumulator {
  readonly segments: Segment[] = [];
  private currentMarkdown: Segment | null = null;
  private currentCode: Segment | null = null;
  private readonly parser: ParserEventSource;

  constructor(parser: ParserEventSource) {
    this.parser = parser;
    parser.onEvent((evt) => {
      this.handleEvent(evt);
    });
  }

  private handleEvent(evt: ParserEvent): void {
    switch (evt.type) {
      case "text.fragment":
        this.appendMarkdown(evt.fragment);
        break;
      case "code.start":
        this.startCode();
        break;
      case "code.fragment":
        this.appendCode(evt.fragment);
        break;
      case "code.end":
        this.endCode();
        break;
    }
  }

  private appendMarkdown(fragment: string): void {
    if (!fragment) return;
    if (!this.currentMarkdown) {
      this.currentMarkdown = { type: "markdown", content: "" };
      this.segments.push(this.currentMarkdown);
    }
    this.currentMarkdown.content += fragment;
  }

  private startCode(): void {
    this.currentMarkdown = null;
    this.currentCode = { type: "code", content: "" };
    this.segments.push(this.currentCode);
  }

  private appendCode(fragment: string): void {
    if (!fragment || !this.currentCode) return;
    this.currentCode.content += fragment;
  }

  private endCode(): void {
    this.currentCode = null;
    this.currentMarkdown = null;
  }

  processChunk(chunk: string): void {
    // Forward chunk processing to the parser if it supports it
    const p = this.parser as { processChunk?: (chunk: string) => void };
    if (p.processChunk) {
      p.processChunk(chunk);
    }
  }
}
