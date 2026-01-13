import { OnFunc } from "@adviser/cement";

import { JsonParser } from "./json-parser.js";
import { OrEvent, OrMeta } from "./openrouter-events.js";

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
export class OpenRouterParser {
  // Unified arktype event callback
  readonly onEvent = OnFunc<(event: OrEvent) => void>();

  private readonly jsonParser: JsonParser;
  private seq = 0;
  private metaEmitted = false;

  constructor(jsonParser: JsonParser) {
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

  private emitMeta(meta: Omit<OrMeta, "type">): void {
    this.onEvent.invoke({
      type: "or.meta",
      ...meta,
    });
  }

  private emitDelta(content: string): void {
    const seq = this.seq++;
    this.onEvent.invoke({ type: "or.delta", content, seq });
  }

  private emitUsage(promptTokens: number, completionTokens: number, totalTokens: number, cost?: number): void {
    this.onEvent.invoke({ type: "or.usage", promptTokens, completionTokens, totalTokens, cost });
  }

  private emitDone(finishReason: string): void {
    this.onEvent.invoke({ type: "or.done", finishReason });
  }

  private emitStreamEnd(): void {
    this.onEvent.invoke({ type: "or.stream-end" });
  }

  private emitJson(json: unknown): void {
    this.onEvent.invoke({ type: "or.json", json });
  }

  private handleJson(json: unknown): void {
    const chunk = json as Record<string, unknown>;

    // Emit raw JSON for downstream consumers (like ToolSchemaParser)
    this.emitJson(chunk);

    // Emit metadata on first chunk
    if (!this.metaEmitted && chunk.id) {
      this.emitMeta({
        id: chunk.id as string,
        provider: chunk.provider as string,
        model: chunk.model as string,
        created: chunk.created as number,
        systemFingerprint: chunk.system_fingerprint as string ?? "",
      });
      this.metaEmitted = true;
    }

    // Extract content delta - OpenAI format: choices[0].delta.content
    const choices = chunk.choices as Array<{ delta?: { content?: string }; finish_reason?: string | null }> | undefined;
    const content = choices?.[0]?.delta?.content;
    if (content) {
      this.emitDelta(content);
    }

    // Extract content delta - Claude format: content_block_delta with text_delta
    if (chunk.type === "content_block_delta") {
      const delta = chunk.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && delta.text) {
        this.emitDelta(delta.text);
      }
    }

    // Check for finish_reason
    const finishReason = choices?.[0]?.finish_reason;
    if (finishReason) {
      this.emitDone(finishReason);
    }

    // Check for usage (final chunk)
    const usage = chunk.usage as
      | {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost?: number;
        }
      | undefined;
    if (usage) {
      this.emitUsage(
        usage.prompt_tokens ?? 0,
        usage.completion_tokens ?? 0,
        usage.total_tokens ?? 0,
        usage.cost
      );
    }
  }

  processChunk(chunk: string): void {
    this.jsonParser.processChunk(chunk);
  }
}
