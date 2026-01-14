import { OnFunc } from "@adviser/cement";

import { OrEvent, OrMeta } from "./openrouter-events.js";

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
 * - or.image: Image data (b64_json or url)
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
    this.onEvent.invoke({ type: "or.meta", ...meta });
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

  private emitImage(index: number, b64_json: string | undefined, url: string | undefined): void {
    this.onEvent.invoke({ type: "or.image", index, b64_json, url });
  }

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
   * Extract base64 from a data URL, or return undefined if not a data URL
   */
  private extractBase64(dataUrl: string): string | undefined {
    const match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    return match ? match[1] : undefined;
  }

  /**
   * Parse a non-streaming JSON response and emit OrEvents.
   * @param json - The parsed JSON response object
   */
  parse(json: unknown): void {
    if (json == null) {
      return;
    }

    const response = json as Record<string, unknown>;

    // Check for Format B (transformed/OpenAI-compatible: { data: [] })
    // This doesn't have choices, so handle it separately
    const data = response.data as Array<{ b64_json?: string; url?: string }> | undefined;
    if (data && Array.isArray(data)) {
      this.emitJson(response);
      data.forEach((item, index) => {
        if (item.b64_json || item.url) {
          this.emitImage(index, item.b64_json, item.url);
        }
      });
      return;
    }

    // Transform to streaming format (message → delta)
    const transformed = this.transformToStreamingFormat(response);

    // Emit transformed JSON for downstream parsers (like ToolSchemaParser)
    this.emitJson(transformed);

    // Emit metadata
    if (transformed.id) {
      this.emitMeta({
        id: transformed.id as string,
        provider: (transformed.provider as string) ?? "",
        model: transformed.model as string,
        created: (transformed.created as number) ?? 0,
        systemFingerprint: (transformed.system_fingerprint as string) ?? "",
      });
    }

    // Extract from transformed format (now uses delta like streaming)
    const choices = transformed.choices as Array<{
      delta?: {
        content?: string | Array<{ type: string; text?: string; input?: unknown }>;
        tool_calls?: Array<{ function?: { arguments?: string } }>;
        function_call?: { arguments?: string };
        images?: Array<{ type: string; image_url?: { url: string } }>;
      };
      finish_reason?: string | null;
    }> | undefined;

    if (choices && choices.length > 0) {
      const choice = choices[0];
      const delta = choice.delta;

      if (delta) {
        const content = delta.content;

        // String content (most common)
        if (typeof content === "string" && content) {
          this.emitDelta(content);
        }
        // Tool calls
        else if (delta.tool_calls?.length) {
          const args = delta.tool_calls[0]?.function?.arguments;
          if (args) {
            this.emitDelta(args);
          }
        }
        // Legacy function_call
        else if (delta.function_call?.arguments) {
          this.emitDelta(delta.function_call.arguments);
        }
        // Content array (Claude-style)
        else if (Array.isArray(content)) {
          const toolUse = content.find((b) => b.type === "tool_use") as { input?: unknown } | undefined;
          if (toolUse?.input) {
            this.emitDelta(JSON.stringify(toolUse.input));
          } else {
            const text = content
              .filter((b) => b.type === "text" && b.text)
              .map((b) => b.text)
              .join("");
            if (text) {
              this.emitDelta(text);
            }
          }
        }

        // Images in delta (Format A: raw OpenRouter)
        if (delta.images && Array.isArray(delta.images)) {
          delta.images.forEach((img, index) => {
            if (img.type === "image_url" && img.image_url?.url) {
              const dataUrl = img.image_url.url;
              const b64 = this.extractBase64(dataUrl);
              this.emitImage(index, b64, b64 ? undefined : dataUrl);
            }
          });
        }
      }

      // Finish reason
      if (choice.finish_reason) {
        this.emitDone(choice.finish_reason);
      }

      // Legacy choice.text fallback (older API formats)
      if (!delta) {
        const legacyText = (choice as { text?: string }).text;
        if (legacyText) {
          this.emitDelta(legacyText);
        }
      }
    }

    // Usage statistics
    const usage = transformed.usage as {
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
