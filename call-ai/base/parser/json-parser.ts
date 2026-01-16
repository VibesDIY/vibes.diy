import { OnFunc } from "@adviser/cement";

import { JsonEvent } from "./json-events.js";

/**
 * DataSource - Interface for any source that provides SSE events
 */
export interface DataSource {
  onEvent: (callback: (event: { type: string; lineNr?: number; payload?: string }) => void) => void;
  processChunk: (chunk: string) => void;
}

/**
 * JsonParser - Parses JSON from any DataSource.
 *
 * This class listens to onEvent events, parses the payload as JSON,
 * and emits JsonEvent for valid JSON. Invalid JSON is silently skipped.
 *
 * Works with SSEDataParser or any source implementing DataSource interface.
 *
 * Usage:
 * ```typescript
 * const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
 * const sseParser = new SSEDataParser(lineParser);
 * const jsonParser = new JsonParser(sseParser);
 *
 * jsonParser.onEvent(evt => {
 *   switch (evt.type) {
 *     case "json.payload": console.log("Parsed JSON:", evt.json); break;
 *     case "json.done": console.log("Stream complete"); break;
 *   }
 * });
 *
 * // Feed chunks from network
 * for await (const chunk of response.body) {
 *   jsonParser.processChunk(chunk);
 * }
 * ```
 */
export class JsonParser {
  // Unified arktype event callback
  readonly onEvent = OnFunc<(event: JsonEvent) => void>();

  private readonly dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.dataSource.onEvent((evt) => {
      switch (evt.type) {
        case "sse.data":
          this.handlePayload(evt.lineNr!, evt.payload!);
          break;
        case "sse.done":
          this.emitDone();
          break;
      }
    });
  }

  private emitPayload(lineNr: number, json: unknown): void {
    this.onEvent.invoke({ type: "json.payload", lineNr, json });
  }

  private emitDone(): void {
    this.onEvent.invoke({ type: "json.done" });
  }

  private handlePayload(lineNr: number, payload: string): void {
    try {
      const json = JSON.parse(payload);
      this.emitPayload(lineNr, json);
    } catch {
      // Invalid JSON, skip
    }
  }

  processChunk(chunk: string): void {
    this.dataSource.processChunk(chunk);
  }
}

// Backward compatibility aliases
export { JsonParser as SSEJsonParser };
