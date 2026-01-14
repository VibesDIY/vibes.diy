/**
 * NonStreamingAdapter - Parses non-streaming OpenRouter responses.
 *
 * Takes a complete JSON response and triggers appropriate events into ParserEvento.
 * Transforms message → delta format and emits standard or.* events.
 */

import { ParserEvento } from "../parser-evento.js";

type ContentBlock = { type?: string; text?: string };
type Message = { content?: string | ContentBlock[]; role?: string };
type Choice = { message?: Message; finish_reason?: string | null };
type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };

interface Response {
  id?: string;
  provider?: string;
  model?: string;
  created?: number;
  system_fingerprint?: string;
  choices?: Choice[];
  usage?: Usage;
}

export class NonStreamingAdapter {
  private seq = 0;

  constructor(private evento: ParserEvento) {}

  parse(json: unknown): void {
    if (json == null) return;

    const response = json as Response;

    // Emit or.json with the original response
    this.evento.trigger({ type: "or.json", json: response });

    // Emit or.meta
    if (response.id) {
      this.evento.trigger({
        type: "or.meta",
        id: response.id,
        provider: response.provider ?? "",
        model: response.model ?? "",
        created: response.created ?? 0,
        systemFingerprint: response.system_fingerprint ?? "",
      });
    }

    // Process choices
    const choice = response.choices?.[0];
    if (choice) {
      // Emit or.delta from message content
      const message = choice.message;
      if (message?.content) {
        const content = this.extractContent(message.content);
        if (content) {
          this.evento.trigger({
            type: "or.delta",
            seq: this.seq++,
            content,
          });
        }
      }

      // Emit or.done
      if (choice.finish_reason) {
        this.evento.trigger({
          type: "or.done",
          finishReason: choice.finish_reason,
        });
      }
    }

    // Emit or.usage
    const usage = response.usage;
    if (usage) {
      this.evento.trigger({
        type: "or.usage",
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
        cost: usage.cost,
      });
    }
  }

  private extractContent(content: string | ContentBlock[]): string {
    if (typeof content === "string") {
      return content;
    }

    // Claude format: array of content blocks
    return content
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("");
  }
}
