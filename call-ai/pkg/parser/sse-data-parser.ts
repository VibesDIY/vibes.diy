import { OnFunc } from "@adviser/cement";

import { LineStreamParser, FragmentEvent } from "./line-stream.js";

/**
 * DataEvent - Emitted for each complete data payload
 */
export interface DataEvent {
  readonly type: "data";
  readonly lineNr: number; // Line number from underlying fragment
  readonly payload: string; // Full payload (without "data: " prefix for SSE)
  readonly isDone: boolean; // True if payload is "[DONE]"
}

/**
 * SSEDataParser - A wrapper around LineStreamParser that extracts SSE data payloads.
 *
 * This class accumulates line fragments internally and emits SSEDataEvent when
 * a complete `data:` line is received. Non-data lines (comments, empty lines)
 * are ignored.
 *
 * Usage:
 * ```typescript
 * const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
 * const sseParser = new SSEDataParser(lineParser);
 *
 * sseParser.onData(evt => {
 *   if (evt.isDone) {
 *     console.log("Stream complete");
 *   } else {
 *     const json = JSON.parse(evt.payload);
 *     console.log(json.choices[0].delta.content);
 *   }
 * });
 *
 * // Feed chunks from network
 * for await (const chunk of response.body) {
 *   sseParser.processChunk(chunk);
 * }
 * ```
 */
export class SSEDataParser {
  readonly onData = OnFunc<(event: DataEvent) => void>();

  private readonly parser: LineStreamParser;
  private lineBuffer = "";
  private currentLineNr = 0;

  constructor(parser: LineStreamParser) {
    this.parser = parser;
    this.parser.onFragment(this.handleFragment.bind(this));
  }

  private handleFragment(evt: FragmentEvent): void {
    this.lineBuffer += evt.fragment;
    this.currentLineNr = evt.lineNr;

    if (evt.lineComplete) {
      const line = this.lineBuffer;
      this.lineBuffer = "";

      if (line.startsWith("data:")) {
        const payload = line.slice(5).trimStart(); // Remove "data:" and optional space
        this.onData.invoke({
          type: "data",
          lineNr: this.currentLineNr,
          payload,
          isDone: payload === "[DONE]",
        });
      }
      // Ignore comment lines (starting with :) and empty lines
    }
  }

  processChunk(chunk: string): void {
    this.parser.processChunk(chunk);
  }
}
