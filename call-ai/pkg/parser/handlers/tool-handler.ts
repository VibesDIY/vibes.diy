/**
 * Tool handler - Extracts tool call events from or.json events.
 *
 * Supports:
 * - Streaming format: choices[].delta.tool_calls[]
 * - Non-streaming format: choices[].message.tool_calls[]
 * - Legacy Claude format: type: "tool_use" with name/input fields
 */

import {
  ParserHandler,
  OrJson,
  HandlerContext,
  ToolStart,
  ToolArguments,
  ToolComplete,
} from "../parser-evento.js";

// Re-export for consumers
export type { ToolStart, ToolArguments, ToolComplete };

interface DeltaToolCall {
  readonly index?: number;
  readonly id?: string;
  readonly function?: { readonly name?: string; readonly arguments?: string };
}

interface MessageToolCall {
  readonly id?: string;
  readonly type?: string;
  readonly function?: { readonly name?: string; readonly arguments?: string };
}

// Legacy Claude tool_use format
interface LegacyToolUse {
  readonly type: "tool_use";
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
}

interface Choice {
  readonly delta?: {
    readonly tool_calls?: DeltaToolCall[];
    readonly content?: LegacyToolUse[];
  };
  readonly message?: {
    readonly tool_calls?: MessageToolCall[];
    readonly content?: LegacyToolUse[];
  };
}

export const toolHandler: ParserHandler = {
  hash: "tool-extractor",
  validate: (event) => {
    if (event.type === "or.json") {
      return { some: event };
    }
    return { none: true };
  },
  handle: (ctx) => {
    const event = ctx.event as OrJson;
    const json = event.json as Record<string, unknown>;

    // Handle legacy Claude formats first (they don't always have choices)
    handleLegacyToolUse(ctx, json);

    const choices = json.choices as Choice[] | undefined;
    if (!choices?.length) return;

    const choice = choices[0];

    // Handle streaming format: delta.tool_calls[]
    if (choice.delta?.tool_calls) {
      handleStreamingToolCalls(ctx, choice.delta.tool_calls);
    }

    // Handle non-streaming format: message.tool_calls[]
    if (choice.message?.tool_calls) {
      handleNonStreamingToolCalls(ctx, choice.message.tool_calls);
    }

    // Handle legacy Claude format in choices[].message.content or delta.content
    if (Array.isArray(choice.message?.content)) {
      const toolUseBlock = choice.message.content.find((block) => block.type === "tool_use");
      if (toolUseBlock) {
        emitLegacyToolComplete(ctx, toolUseBlock);
      }
    }
    if (Array.isArray(choice.delta?.content)) {
      const toolUseBlock = choice.delta.content.find((block) => block.type === "tool_use");
      if (toolUseBlock) {
        emitLegacyToolComplete(ctx, toolUseBlock);
      }
    }
  },
};

function handleStreamingToolCalls(ctx: HandlerContext, toolCalls: DeltaToolCall[]): void {
  for (const tc of toolCalls) {
    const index = tc.index ?? 0;

    // Emit start event if id is present (first chunk for this tool call)
    if (tc.id) {
      ctx.emit({
        type: "tool.start",
        index,
        callId: tc.id,
        functionName: tc.function?.name,
      } as ToolStart);
    }

    // Emit arguments event if arguments fragment is present
    if (tc.function?.arguments) {
      ctx.emit({
        type: "tool.arguments",
        index,
        fragment: tc.function.arguments,
      } as ToolArguments);
    }
  }
}

function handleNonStreamingToolCalls(ctx: HandlerContext, toolCalls: MessageToolCall[]): void {
  for (const tc of toolCalls) {
    if (tc.id && tc.function) {
      ctx.emit({
        type: "tool.complete",
        callId: tc.id,
        functionName: tc.function.name,
        arguments: tc.function.arguments ?? "",
      } as ToolComplete);
    }
  }
}

/**
 * Handle legacy Claude tool_use formats:
 * - Direct: { type: "tool_use", id, name, input }
 * - With stop_reason: { stop_reason: "tool_use", content: [{ type: "tool_use", ... }] }
 */
function handleLegacyToolUse(ctx: HandlerContext, json: Record<string, unknown>): void {
  // Format 1: Direct type: "tool_use"
  if (json.type === "tool_use") {
    emitLegacyToolComplete(ctx, json as unknown as LegacyToolUse);
    return;
  }

  // Format 2: stop_reason: "tool_use" with content array
  if (json.stop_reason === "tool_use" && Array.isArray(json.content)) {
    const toolUseBlock = (json.content as LegacyToolUse[]).find((block) => block.type === "tool_use");
    if (toolUseBlock) {
      emitLegacyToolComplete(ctx, toolUseBlock);
    }
  }
}

function emitLegacyToolComplete(ctx: HandlerContext, toolUse: LegacyToolUse): void {
  ctx.emit({
    type: "tool.complete",
    callId: toolUse.id ?? crypto.randomUUID(),
    functionName: toolUse.name,
    arguments: typeof toolUse.input === "string" ? toolUse.input : JSON.stringify(toolUse.input ?? {}),
  } as ToolComplete);
}
