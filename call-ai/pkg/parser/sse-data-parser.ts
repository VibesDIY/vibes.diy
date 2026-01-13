import { OnFunc } from "@adviser/cement";

import { LineStreamParser } from "./line-stream.js";
import { SseEvent } from "./sse-events.js";
import { LineFragment } from "./line-events.js";

/**
 * SSEDataParser - A wrapper around LineStreamParser that extracts SSE data payloads.
 *
 * This class accumulates line fragments internally and emits events when
 * a complete `data:` line is received. Non-data lines (comments, empty lines)
 * are ignored.
 *
 * Events:
 * - `sse.data` - Emitted for each data line (except [DONE])
 * - `sse.done` - Emitted when [DONE] marker is received
 *
 * Usage:
 * ```typescript
 * const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
 * const sseParser = new SSEDataParser(lineParser);
 *
 * sseParser.onEvent(evt => {
 *   switch (evt.type) {
 *     case "sse.data":
 *       const json = JSON.parse(evt.payload);
 *       console.log(json.choices[0].delta.content);
 *       break;
 *     case "sse.done":
 *       console.log("Stream complete");
 *       break;
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
  readonly onEvent = OnFunc<(event: SseEvent) => void>();

  private readonly parser: LineStreamParser;
  private lineBuffer = "";
  private currentLineNr = 0;

  constructor(parser: LineStreamParser) {
    this.parser = parser;
    this.parser.onEvent((evt) => {
      if (evt.type === "line.fragment") {
        this.handleFragment(evt);
      }
    });
  }

  private handleFragment(evt: LineFragment): void {
    this.lineBuffer += evt.fragment;
    this.currentLineNr = evt.lineNr;

    if (evt.lineComplete) {
      const line = this.lineBuffer;
      this.lineBuffer = "";

      if (line.startsWith("data:")) {
        const payload = line.slice(5).trimStart(); // Remove "data:" and optional space
        if (payload === "[DONE]") {
          this.onEvent.invoke({
            type: "sse.done",
            lineNr: this.currentLineNr,
          });
        } else {
          this.onEvent.invoke({
            type: "sse.data",
            lineNr: this.currentLineNr,
            payload,
          });
        }
      }
      // Ignore comment lines (starting with :) and empty lines
    }
  }

  processChunk(chunk: string): void {
    this.parser.processChunk(chunk);
  }
}
