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
    // Handle null/undefined input
    if (json == null) {
      return;
    }

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

      // Extract content - priority order matches what models actually return
      if (choice.message) {
        const content = choice.message.content;

        // 1. String content (most common - OpenAI, Gemini, etc.)
        if (typeof content === "string" && content) {
          this.emitDelta(content);
        }
        // 2. tool_calls (OpenAI function calling)
        else if (choice.message.tool_calls && Array.isArray(choice.message.tool_calls) && choice.message.tool_calls.length > 0) {
          const toolCall = choice.message.tool_calls[0] as { function?: { arguments?: string } };
          if (toolCall.function?.arguments) {
            this.emitDelta(toolCall.function.arguments);
          }
        }
        // 3. function_call (legacy OpenAI format)
        else if (choice.message.function_call) {
          const funcCall = choice.message.function_call as { arguments?: string };
          if (funcCall.arguments) {
            this.emitDelta(funcCall.arguments);
          }
        }
        // 4. Content array (Claude-style content blocks)
        else if (Array.isArray(content)) {
          // Check for tool_use blocks first (Claude tool calling)
          const toolUse = content.find((block: { type: string }) => block.type === "tool_use") as { input?: unknown } | undefined;
          if (toolUse?.input) {
            this.emitDelta(JSON.stringify(toolUse.input));
          } else {
            // Fall back to concatenating text blocks
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
        }
      }
      // 5. choice.text fallback (older API formats)
      else if ((choice as { text?: string }).text) {
        this.emitDelta((choice as { text: string }).text);
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
}
