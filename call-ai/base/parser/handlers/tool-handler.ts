/**
 * Tool handler - Extracts tool call events from or.json events.
 *
 * Supports:
 * - Streaming format: choices[].delta.tool_calls[]
 * - Non-streaming format: choices[].message.tool_calls[]
 * - Legacy Claude format: type: "tool_use" with name/input fields
 *
 * For streaming tool calls, accumulates arguments fragments and emits
 * tool.complete on or.done or or.stream-end events.
 */

import {
  ParserHandler,
  ParserEvent,
  OrJson,
  OrDone,
  OrStreamEnd,
  HandlerContext,
  ToolStart,
  ToolArguments,
  ToolComplete,
} from "../parser-evento.js";

// Re-export for consumers
export type { ToolStart, ToolArguments, ToolComplete };

// Accumulated state for streaming tool calls
interface StreamingToolCall {
  id: string;
  name?: string;
  args: string;
}

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

/**
 * Create a tool handler with isolated state for streaming tool call accumulation.
 * Use this factory when you need state isolation (e.g., multiple concurrent streams).
 */
export function createToolHandler(): ParserHandler {
  // State for accumulated streaming tool calls (by index)
  const streamingToolCalls = new Map<number, StreamingToolCall>();

  return {
    hash: "tool-extractor",
    validate: (event: ParserEvent) => {
      // Handle or.json, or.done, and or.stream-end events
      if (event.type === "or.json" || event.type === "or.done" || event.type === "or.stream-end") {
        return { some: event };
      }
      return { none: true };
    },
    handle: (ctx) => {
      const event = ctx.event;

      // Handle stream completion events
      if (event.type === "or.done" || event.type === "or.stream-end") {
        emitAccumulatedToolCalls(ctx, streamingToolCalls);
        return;
      }

      // Handle or.json events
      const json = (event as OrJson).json as Record<string, unknown>;

      // Handle legacy Claude formats first (they don't always have choices)
      handleLegacyToolUse(ctx, json);

      const choices = json.choices as Choice[] | undefined;
      if (!choices?.length) return;

      const choice = choices[0];

      // Handle streaming format: delta.tool_calls[]
      if (choice.delta?.tool_calls) {
        handleStreamingToolCalls(ctx, choice.delta.tool_calls, streamingToolCalls);
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
}

// Default singleton for backward compatibility (use createToolHandler() for isolated state)
export const toolHandler: ParserHandler = createToolHandler();

function handleStreamingToolCalls(
  ctx: HandlerContext,
  toolCalls: DeltaToolCall[],
  accumulated: Map<number, StreamingToolCall>,
): void {
  for (const tc of toolCalls) {
    const index = tc.index ?? 0;

    // Initialize or update accumulated state
    let state = accumulated.get(index);
    if (!state) {
      state = { id: "", name: undefined, args: "" };
      accumulated.set(index, state);
    }

    // Capture id if present (first chunk)
    if (tc.id) {
      state.id = tc.id;
      // Emit start event
      ctx.emit({
        type: "tool.start",
        index,
        callId: tc.id,
        functionName: tc.function?.name,
      } as ToolStart);
    }

    // Capture function name if present
    if (tc.function?.name) {
      state.name = tc.function.name;
    }

    // Accumulate arguments and emit fragment event
    if (tc.function?.arguments) {
      state.args += tc.function.arguments;
      ctx.emit({
        type: "tool.arguments",
        index,
        fragment: tc.function.arguments,
      } as ToolArguments);
    }
  }
}

function emitAccumulatedToolCalls(ctx: HandlerContext, accumulated: Map<number, StreamingToolCall>): void {
  // Emit tool.complete for each accumulated streaming tool call
  for (const [, state] of accumulated) {
    if (state.id) {
      ctx.emit({
        type: "tool.complete",
        callId: state.id,
        functionName: state.name,
        arguments: state.args,
      } as ToolComplete);
    }
  }
  // Clear state after emitting
  accumulated.clear();
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
