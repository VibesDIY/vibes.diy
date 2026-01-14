import { BaseOpenRouterParser } from "./base-openrouter-parser.js";

/**
 * NonStreamingOpenRouterParser - Interprets non-streaming OpenRouter JSON responses.
 *
 * This class takes a complete JSON response, transforms it to streaming format
 * (message → delta), and emits the same OrEvent types as the streaming OpenRouterParser.
 * This provides a consistent interface for downstream consumers like ToolSchemaParser.
 *
 * Events emitted:
 * - or.json: Raw JSON (transformed to streaming format)
 * - or.meta: Response metadata (id, provider, model, created)
 * - or.delta: Content (single event with full content, seq=0)
 * - or.done: Finish reason
 * - or.usage: Token usage statistics
 *
 * Usage:
 * ```typescript
 * const parser = new NonStreamingOpenRouterParser();
 *
 * parser.onEvent(evt => {
 *   switch (evt.type) {
 *     case "or.meta": console.log("Model:", evt.model); break;
 *     case "or.delta": console.log("Content:", evt.content); break;
 *     case "or.done": console.log("Finished:", evt.finishReason); break;
 *     case "or.usage": console.log("Tokens:", evt.totalTokens); break;
 *   }
 * });
 *
 * parser.parse(jsonResponse);
 * ```
 */
export class NonStreamingOpenRouterParser extends BaseOpenRouterParser {

  /**
   * Transform non-streaming response to streaming format.
   * Converts choices[].message → choices[].delta
   */
  private transformToStreamingFormat(json: Record<string, unknown>): Record<string, unknown> {
    const choices = json.choices as Array<Record<string, unknown>> | undefined;
    if (!choices?.[0]?.message) {
      return json;
    }

    // Deep clone to avoid mutating input
    const transformed = JSON.parse(JSON.stringify(json)) as Record<string, unknown>;
    const transformedChoices = transformed.choices as Array<Record<string, unknown>>;

    for (const choice of transformedChoices) {
      if (choice.message) {
        choice.delta = choice.message;
        delete choice.message;
      }
    }

    return transformed;
  }


  /**
   * Parse a non-streaming JSON response and emit OrEvents.
   * @param json - The parsed JSON response object
   */
  parse(json: unknown): void {
    if (json == null) {
      return;
    }

    this.resetStreamState();

    const response = json as Record<string, unknown>;
    const transformed = this.transformToStreamingFormat(response);

    this.dispatchOpenRouterChunk(transformed);
  }
}
