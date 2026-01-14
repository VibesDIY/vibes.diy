import { OnFunc } from "@adviser/cement";

import { OrEvent, OrMeta } from "./openrouter-events.js";

type ChoiceContentBlock = { type?: string; text?: string; input?: unknown };
type ChoiceDelta = {
  content?: string | ChoiceContentBlock[];
  tool_calls?: Array<{ function?: { arguments?: string } }>;
  function_call?: { arguments?: string };
};
type Choice = {
  delta?: ChoiceDelta;
  finish_reason?: string | null;
  text?: string;
};

type UsageChunk = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
};

type ClaudeContentBlockDelta = {
  type?: string;
  delta?: { type?: string; text?: string };
};

/**
 * BaseOpenRouterParser centralizes the logic for turning OpenRouter JSON
 * (either streaming chunks or transformed non-streaming payloads) into
 * canonical `or.*` events. Concrete streaming/non-streaming adapters are
 * responsible for supplying JSON chunks and managing stream lifecycle.
 */
export abstract class BaseOpenRouterParser {
  readonly onEvent = OnFunc<(event: OrEvent) => void>();

  private seq = 0;
  private metaEmitted = false;

  protected resetStreamState(): void {
    this.seq = 0;
    this.metaEmitted = false;
  }

  protected dispatchOpenRouterChunk(chunk: Record<string, unknown>): void {
    this.emitJson(chunk);
    this.emitMetaOnce(chunk);
    this.emitDeltaFromChoice(chunk);
    this.emitDeltaFromClaudeBlock(chunk);
    this.emitDoneIfNeeded(chunk);
    this.emitLegacyChoiceText(chunk);
    this.emitUsageIfPresent(chunk);
  }

  private emitJson(json: unknown): void {
    this.onEvent.invoke({ type: "or.json", json });
  }

  private emitMeta(meta: Omit<OrMeta, "type">): void {
    this.onEvent.invoke({ type: "or.meta", ...meta });
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

  private emitMetaOnce(chunk: Record<string, unknown>): void {
    if (this.metaEmitted || !chunk.id) {
      return;
    }

    this.emitMeta({
      id: chunk.id as string,
      provider: (chunk.provider as string) ?? "",
      model: chunk.model as string,
      created: (chunk.created as number) ?? 0,
      systemFingerprint: (chunk.system_fingerprint as string) ?? "",
    });
    this.metaEmitted = true;
  }

  private emitDeltaFromChoice(chunk: Record<string, unknown>): void {
    const choices = chunk.choices as Choice[] | undefined;
    if (!choices || choices.length === 0) {
      return;
    }

    const delta = choices[0]?.delta;
    if (!delta) {
      return;
    }

    const content = delta.content;
    if (typeof content === "string" && content) {
      this.emitDelta(content);
      return;
    }

    if (Array.isArray(content)) {
      const toolUse = content.find((block) => block.type === "tool_use");
      if (toolUse?.input != null) {
        this.emitDelta(JSON.stringify(toolUse.input));
        return;
      }

      const text = content
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("");
      if (text) {
        this.emitDelta(text);
        return;
      }
    }

    if (delta.tool_calls?.length) {
      const args = delta.tool_calls[0]?.function?.arguments;
      if (args) {
        this.emitDelta(args);
        return;
      }
    }

    if (delta.function_call?.arguments) {
      this.emitDelta(delta.function_call.arguments);
    }
  }

  private emitDeltaFromClaudeBlock(chunk: Record<string, unknown>): void {
    const claudeChunk = chunk as ClaudeContentBlockDelta;
    if (claudeChunk.type !== "content_block_delta") {
      return;
    }

    const delta = claudeChunk.delta;
    if (delta?.type === "text_delta" && delta.text) {
      this.emitDelta(delta.text);
    }
  }

  private emitDoneIfNeeded(chunk: Record<string, unknown>): void {
    const choices = chunk.choices as Choice[] | undefined;
    const finishReason = choices?.[0]?.finish_reason;
    if (finishReason) {
      this.emitDone(finishReason);
    }
  }

  private emitLegacyChoiceText(chunk: Record<string, unknown>): void {
    const choices = chunk.choices as Choice[] | undefined;
    if (choices?.[0]?.delta) {
      return;
    }

    const legacyText = choices?.[0]?.text;
    if (legacyText) {
      this.emitDelta(legacyText);
    }
  }

  private emitUsageIfPresent(chunk: Record<string, unknown>): void {
    const usage = chunk.usage as UsageChunk | undefined;
    if (!usage) {
      return;
    }

    this.emitUsage(usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0, usage.total_tokens ?? 0, usage.cost);
  }
}
