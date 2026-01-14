import { JsonParser } from "./json-parser.js";
import { BaseOpenRouterParser } from "./base-openrouter-parser.js";

/**
 * OpenRouterParser - Interprets OpenRouter-specific JSON structure.
 *
 * This class listens to JsonParser events and extracts:
 * - Text content deltas (or.delta)
 * - Stream metadata like model, provider (or.meta)
 * - Usage statistics from final chunk (or.usage)
 * - Finish reason (or.done)
 * - Raw JSON chunks (or.json)
 * - Stream completion (or.stream-end)
 *
 * Usage:
 * ```typescript
 * const orParser = new OpenRouterParser(jsonParser);
 *
 * orParser.onEvent(evt => {
 *   switch (evt.type) {
 *     case "or.meta": console.log("Model:", evt.model); break;
 *     case "or.delta": process.stdout.write(evt.content); break;
 *     // ...
 *   }
 * });
 *
 * for await (const chunk of response.body) {
 *   orParser.processChunk(chunk);
 * }
 * ```
 */
export class OpenRouterParser extends BaseOpenRouterParser {
  private readonly jsonParser: JsonParser;

  constructor(jsonParser: JsonParser) {
    super();
    this.jsonParser = jsonParser;
    this.jsonParser.onEvent((evt) => {
      switch (evt.type) {
        case "json.payload":
          this.handleJson(evt.json);
          break;
        case "json.done":
          this.emitStreamEnd();
          break;
      }
    });
  }

  private emitStreamEnd(): void {
    this.onEvent.invoke({ type: "or.stream-end" });
  }

  private handleJson(json: unknown): void {
    this.dispatchOpenRouterChunk(json as Record<string, unknown>);
  }

  processChunk(chunk: string): void {
    this.jsonParser.processChunk(chunk);
  }
}
