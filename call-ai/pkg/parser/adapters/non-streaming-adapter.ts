/**
 * NonStreamingAdapter - Parses non-streaming OpenRouter responses.
 *
 * Takes a complete JSON response and triggers appropriate events into ParserEvento.
 * Extracts content from various formats: message.content, tool_calls, function_call, choice.text
 */

import { ParserEvento } from "../parser-evento.js";

type ContentBlock = { type?: string; text?: string; input?: unknown };
type ToolCall = { function?: { arguments?: string } };
type FunctionCall = { arguments?: string };
type Message = {
  content?: string | ContentBlock[];
  role?: string;
  tool_calls?: ToolCall[];
  function_call?: FunctionCall;
  images?: Array<{ type: string; image_url?: { url: string } }>;
};
type Choice = {
  message?: Message;
  delta?: Message;
  text?: string;
  finish_reason?: string | null;
};
type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };

interface Response {
  id?: string;
  provider?: string;
  model?: string;
  created?: number;
  system_fingerprint?: string;
  choices?: Choice[];
  usage?: Usage;
  data?: Array<{ b64_json?: string; url?: string }>;
}

export class NonStreamingAdapter {
  private seq = 0;

  constructor(private evento: ParserEvento) {}

  parse(json: unknown): void {
    if (json == null) return;

    const response = json as Response;

    // Transform to streaming format for or.json event (message → delta)
    const transformed = this.transformToStreamingFormat(response);
    this.evento.trigger({ type: "or.json", json: transformed });

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
      const content = this.extractContentFromChoice(choice);
      if (content) {
        this.evento.trigger({
          type: "or.delta",
          seq: this.seq++,
          content,
        });
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

  /**
   * Transform non-streaming response to streaming format.
   * Converts choices[].message → choices[].delta
   */
  private transformToStreamingFormat(response: Response): Response {
    const choices = response.choices;
    if (!choices?.[0]?.message) {
      return response;
    }

    // Deep clone to avoid mutating input
    const transformed = JSON.parse(JSON.stringify(response)) as Response;
    const transformedChoices = transformed.choices as Array<{ message?: Message; delta?: Message }>;

    for (const choice of transformedChoices) {
      if (choice.message) {
        choice.delta = choice.message;
        delete choice.message;
      }
    }

    return transformed;
  }

  private extractContentFromChoice(choice: Choice): string {
    const message = choice.message;
    if (!message) {
      // Fallback to choice.text
      return choice.text ?? "";
    }

    // 1. Check for tool_calls
    if (message.tool_calls?.length) {
      const args = message.tool_calls[0]?.function?.arguments;
      if (args) return args;
    }

    // 2. Check for legacy function_call
    if (message.function_call?.arguments) {
      return message.function_call.arguments;
    }

    // 3. Handle content
    const content = message.content;
    if (content == null) {
      return "";
    }

    if (typeof content === "string") {
      return content;
    }

    // Array content blocks
    if (Array.isArray(content)) {
      // Check for tool_use blocks first
      const toolUse = content.find((block) => block.type === "tool_use");
      if (toolUse?.input != null) {
        return JSON.stringify(toolUse.input);
      }

      // Concatenate text blocks
      return content
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("");
    }

    return "";
  }
}
