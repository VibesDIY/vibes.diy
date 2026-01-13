import { OnFunc } from "@adviser/cement";

import { JsonParser, JsonEvent } from "./json-parser.js";
import { OrEvent } from "./openrouter-events.js";

/**
 * OpenRouterMeta - Metadata from the first chunk
 */
export interface OpenRouterMeta {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly created: number;
  readonly systemFingerprint: string;
}

/**
 * OpenRouterDeltaEvent - Text content delta
 */
export interface OpenRouterDeltaEvent {
  readonly type: "delta";
  readonly content: string;
  readonly seq: number;
}

/**
 * OpenRouterUsageEvent - Usage statistics from final chunk
 */
export interface OpenRouterUsageEvent {
  readonly type: "usage";
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly cost?: number;
}

/**
 * OpenRouterDoneEvent - Stream completion
 */
export interface OpenRouterDoneEvent {
  readonly type: "done";
  readonly finishReason: string;
}

export type OpenRouterEvent = OpenRouterDeltaEvent | OpenRouterUsageEvent | OpenRouterDoneEvent;

/**
 * OpenRouterParser - Interprets OpenRouter-specific JSON structure.
 *
 * This class listens to SSEJsonParser events and extracts:
 * - Text content deltas (onDelta)
 * - Stream metadata like model, provider (onMeta)
 * - Usage statistics from final chunk (onUsage)
 * - Finish reason (onDone)
 *
 * Usage:
 * ```typescript
 * const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
 * const sseParser = new SSEDataParser(lineParser);
 * const jsonParser = new JsonParser(sseParser);
 * const orParser = new OpenRouterParser(jsonParser);
 *
 * orParser.onMeta(meta => console.log("Model:", meta.model));
 * orParser.onDelta(evt => process.stdout.write(evt.content));
 * orParser.onUsage(evt => console.log("Tokens:", evt.totalTokens));
 * orParser.onDone(evt => console.log("Finished:", evt.finishReason));
 *
 * for await (const chunk of response.body) {
 *   orParser.processChunk(chunk);
 * }
 * ```
 */
export class OpenRouterParser {
  // Legacy callbacks (kept for backward compatibility)
  readonly onDelta = OnFunc<(event: OpenRouterDeltaEvent) => void>();
  readonly onUsage = OnFunc<(event: OpenRouterUsageEvent) => void>();
  readonly onDone = OnFunc<(event: OpenRouterDoneEvent) => void>();
  readonly onMeta = OnFunc<(meta: OpenRouterMeta) => void>();
  readonly onJson = OnFunc<(event: { json: unknown }) => void>();
  readonly onStreamEnd = OnFunc<() => void>(); // Fires on [DONE] from SSE

  // Unified arktype event callback
  readonly onEvent = OnFunc<(event: OrEvent) => void>();

  private readonly jsonParser: JsonParser;
  private seq = 0;
  private metaEmitted = false;

  constructor(jsonParser: JsonParser) {
    this.jsonParser = jsonParser;
    this.jsonParser.onJson(this.handleJson.bind(this));
    this.jsonParser.onDone(() => this.emitStreamEnd());
  }

  private emitMeta(meta: OpenRouterMeta): void {
    this.onMeta.invoke(meta);
    this.onEvent.invoke({
      type: "or.meta",
      id: meta.id,
      provider: meta.provider,
      model: meta.model,
      created: meta.created,
      systemFingerprint: meta.systemFingerprint,
    });
  }

  private emitDelta(content: string): void {
    const seq = this.seq++;
    this.onDelta.invoke({ type: "delta", content, seq });
    this.onEvent.invoke({ type: "or.delta", content, seq });
  }

  private emitUsage(promptTokens: number, completionTokens: number, totalTokens: number, cost?: number): void {
    this.onUsage.invoke({ type: "usage", promptTokens, completionTokens, totalTokens, cost });
    this.onEvent.invoke({ type: "or.usage", promptTokens, completionTokens, totalTokens, cost });
  }

  private emitDone(finishReason: string): void {
    this.onDone.invoke({ type: "done", finishReason });
    this.onEvent.invoke({ type: "or.done", finishReason });
  }

  private emitStreamEnd(): void {
    this.onStreamEnd.invoke();
    this.onEvent.invoke({ type: "or.stream-end" });
  }

  private handleJson(evt: JsonEvent): void {
    const chunk = evt.json as Record<string, unknown>;

    // Emit raw JSON for downstream consumers (like ToolSchemaParser)
    this.onJson.invoke({ json: chunk });

    // Emit metadata on first chunk
    if (!this.metaEmitted && chunk.id) {
      this.emitMeta({
        id: chunk.id as string,
        provider: chunk.provider as string,
        model: chunk.model as string,
        created: chunk.created as number,
        systemFingerprint: chunk.system_fingerprint as string,
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
