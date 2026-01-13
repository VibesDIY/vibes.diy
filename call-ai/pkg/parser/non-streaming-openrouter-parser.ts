import { OnFunc } from "@adviser/cement";

import { OrEvent, OrMeta } from "./openrouter-events.js";

/**
 * NonStreamingOpenRouterParser - Interprets non-streaming OpenRouter JSON responses.
 *
 * This class takes a complete JSON response and emits the same OrEvent types
 * as the streaming OpenRouterParser, providing a consistent interface for testing
 * and processing both streaming and non-streaming responses.
 *
 * Events emitted:
 * - or.meta: Response metadata (id, provider, model, created)
 * - or.delta: Content (single event with full content, seq=0)
 * - or.done: Finish reason
 * - or.usage: Token usage statistics
 * - or.json: Raw JSON response
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
export class NonStreamingOpenRouterParser {
  readonly onEvent = OnFunc<(event: OrEvent) => void>();

  private emitMeta(meta: Omit<OrMeta, "type">): void {
    this.onEvent.invoke({
      type: "or.meta",
      ...meta,
    });
  }

  private emitDelta(content: string): void {
    this.onEvent.invoke({ type: "or.delta", content, seq: 0 });
  }

  private emitUsage(promptTokens: number, completionTokens: number, totalTokens: number, cost?: number): void {
    this.onEvent.invoke({ type: "or.usage", promptTokens, completionTokens, totalTokens, cost });
  }

  private emitDone(finishReason: string): void {
    this.onEvent.invoke({ type: "or.done", finishReason });
  }

  private emitJson(json: unknown): void {
    this.onEvent.invoke({ type: "or.json", json });
  }

  /**
   * Parse a non-streaming JSON response and emit OrEvents.
   * @param json - The parsed JSON response object
   */
  parse(json: unknown): void {
    const response = json as Record<string, unknown>;

    // Emit raw JSON first
    this.emitJson(response);

    // Emit metadata
    if (response.id) {
      this.emitMeta({
        id: response.id as string,
        provider: (response.provider as string) ?? "",
        model: response.model as string,
        created: (response.created as number) ?? 0,
        systemFingerprint: (response.system_fingerprint as string) ?? "",
      });
    }

    // Extract content from choices
    const choices = response.choices as Array<{
      message?: {
        content?: string | Array<{ type: string; text?: string }>;
        tool_calls?: unknown[];
        function_call?: unknown;
      };
      finish_reason?: string | null;
    }> | undefined;

    if (choices && choices.length > 0) {
      const choice = choices[0];

      // Extract content - handle both string and content blocks format
      if (choice.message) {
        const content = choice.message.content;

        if (typeof content === "string" && content) {
          this.emitDelta(content);
        } else if (Array.isArray(content)) {
          // Handle Claude-style content blocks
          let textContent = "";
          for (const block of content) {
            if (block.type === "text" && block.text) {
              textContent += block.text;
            }
          }
          if (textContent) {
            this.emitDelta(textContent);
          }
        }

        // Note: tool_calls and function_call are available in the or.json event
        // Consumers needing tool call data should use the or.json event
      }

      // Emit finish reason
      if (choice.finish_reason) {
        this.emitDone(choice.finish_reason);
      }
    }

    // Emit usage statistics
    const usage = response.usage as {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      cost?: number;
    } | undefined;

    if (usage) {
      this.emitUsage(
        usage.prompt_tokens ?? 0,
        usage.completion_tokens ?? 0,
        usage.total_tokens ?? 0,
        usage.cost
      );
    }
  }

  /**
   * Convenience method to parse a JSON string.
   * @param jsonString - The JSON string to parse
   */
  parseString(jsonString: string): void {
    this.parse(JSON.parse(jsonString));
  }
}
