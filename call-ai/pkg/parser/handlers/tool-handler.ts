/**
 * Tool handler - Extracts tool call events from or.json events.
 *
 * Supports:
 * - Streaming format: choices[].delta.tool_calls[]
 * - Non-streaming format: choices[].message.tool_calls[]
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

interface Choice {
  readonly delta?: { readonly tool_calls?: DeltaToolCall[] };
  readonly message?: { readonly tool_calls?: MessageToolCall[] };
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
