import { OnFunc } from "@adviser/cement";

import { DataEvent } from "./sse-data-parser.js";

/**
 * DataSource - Interface for any source that provides data events
 */
export interface DataSource {
  onData: (callback: (event: DataEvent) => void) => void;
  processChunk: (chunk: string) => void;
}

/**
 * JsonEvent - Emitted for each data payload parsed as JSON
 */
export interface JsonEvent {
  readonly type: "json";
  readonly lineNr: number;
  readonly json: unknown; // The parsed JSON payload
}

/**
 * JsonParser - Parses JSON from any DataSource.
 *
 * This class listens to onData events, parses the payload as JSON,
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
 * jsonParser.onJson(evt => {
 *   console.log("Parsed JSON:", evt.json);
 * });
 *
 * jsonParser.onDone(() => {
 *   console.log("Stream complete");
 * });
 *
 * // Feed chunks from network
 * for await (const chunk of response.body) {
 *   jsonParser.processChunk(chunk);
 * }
 * ```
 */
export class JsonParser {
  readonly onJson = OnFunc<(event: JsonEvent) => void>();
  readonly onDone = OnFunc<() => void>(); // When [DONE] received

  private readonly dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.dataSource.onData(this.handleData.bind(this));
  }

  private handleData(evt: DataEvent): void {
    if (evt.isDone) {
      this.onDone.invoke();
      return;
    }

    try {
      const json = JSON.parse(evt.payload);
      this.onJson.invoke({
        type: "json",
        lineNr: evt.lineNr,
        json,
      });
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
export type { JsonEvent as SSEJsonEvent };
