import { CodeBlockParser } from "./code-block-parser.js";

/**
 * Segment - A block of content (markdown or code)
 * Matches the shape used by @vibes.diy/prompts
 */
export interface Segment {
  type: "markdown" | "code";
  content: string;
}

/**
 * SegmentAccumulator - Builds growing Segment[] from CodeBlockParser events.
 *
 * This class listens to CodeBlockParser events and accumulates them into
 * a segments array that grows as content streams in. The segments array
 * follows the pattern: markdown → code → markdown → code → ...
 *
 * Usage:
 * ```typescript
 * const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
 * const sseParser = new SSEDataParser(lineParser);
 * const jsonParser = new JsonParser(sseParser);
 * const orParser = new OpenRouterParser(jsonParser);
 * const codeParser = new CodeBlockParser(orParser);
 * const accumulator = new SegmentAccumulator(codeParser);
 *
 * // Feed chunks from network
 * for await (const chunk of response.body) {
 *   accumulator.processChunk(chunk);
 *   // accumulator.segments grows as content arrives
 *   render(accumulator.segments);
 * }
 * ```
 */
export class SegmentAccumulator {
  readonly segments: Segment[] = [];

  private currentMarkdown: Segment | null = null;
  private currentCode: Segment | null = null;
  private readonly codeParser: CodeBlockParser;

  constructor(codeParser: CodeBlockParser) {
    this.codeParser = codeParser;
    codeParser.onTextFragment((evt) => this.appendMarkdown(evt.fragment));
    codeParser.onCodeStart(() => this.startCode());
    codeParser.onCodeFragment((evt) => this.appendCode(evt.fragment));
    codeParser.onCodeEnd(() => this.endCode());
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
    this.codeParser.processChunk(chunk);
  }
}
