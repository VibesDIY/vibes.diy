import { OnFunc } from "@adviser/cement";
import { OpenRouterParser } from "./openrouter-parser.js";

// Events
export interface ToolCallStartEvent {
  readonly type: "toolCallStart";
  readonly seq: number;
  readonly callId: string;
  readonly functionName?: string;
}

export interface ToolCallArgumentsEvent {
  readonly type: "toolCallArguments";
  readonly seq: number;
  readonly callId: string;
  readonly fragment: string;
}

export interface ToolCallCompleteEvent {
  readonly type: "toolCallComplete";
  readonly seq: number;
  readonly callId: string;
  readonly arguments: string;  // Complete JSON string
}

export class ToolSchemaParser {
  readonly onToolCallStart = OnFunc<(event: ToolCallStartEvent) => void>();
  readonly onToolCallArguments = OnFunc<(event: ToolCallArgumentsEvent) => void>();
  readonly onToolCallComplete = OnFunc<(event: ToolCallCompleteEvent) => void>();

  private readonly orParser: OpenRouterParser;
  private seq = 0;

  // Support multiple parallel tool calls via index-keyed maps
  private toolCalls: Map<number, {
    id: string;
    name?: string;
    arguments: string;
    started: boolean;
  }> = new Map();

  constructor(orParser: OpenRouterParser) {
    this.orParser = orParser;
    // @ts-ignore - onJson will be added to OpenRouterParser in the next step
    this.orParser.onJson(this.handleJson.bind(this));
    this.orParser.onDone(this.handleDone.bind(this));
  }

  private handleJson(evt: { json: unknown }): void {
    const json = evt.json as Record<string, unknown>;
    // Extract tool_calls from choices[0].delta.tool_calls
    const choices = json.choices as Array<{delta?: {tool_calls?: Array<{index?: number; id?: string; function?: {name?: string; arguments?: string}}>}}>;
    const toolCalls = choices?.[0]?.delta?.tool_calls;

    if (toolCalls) {
      for (const tc of toolCalls) {
        const index = tc.index ?? 0;

        // Get or create tool call state
        let state = this.toolCalls.get(index);
        if (!state) {
          state = { id: tc.id || `tool-${index}`, arguments: "", started: false };
          this.toolCalls.set(index, state);
        }

        // Update id/name if provided (first chunk has these)
        if (tc.id) state.id = tc.id;
        if (tc.function?.name) state.name = tc.function.name;

        // Emit start event on first encounter
        if (!state.started) {
          state.started = true;
          this.onToolCallStart.invoke({
            type: "toolCallStart",
            seq: this.seq++,
            callId: state.id,
            functionName: state.name,
          });
        }

        // Arguments fragment
        if (tc.function?.arguments) {
          state.arguments += tc.function.arguments;
          this.onToolCallArguments.invoke({
            type: "toolCallArguments",
            seq: this.seq++,
            callId: state.id,
            fragment: tc.function.arguments,
          });
        }
      }
    }
  }

  private handleDone(evt: { finishReason: string }): void {
    if (evt.finishReason === "tool_calls") {
      // Emit complete for all accumulated tool calls
      for (const [, state] of this.toolCalls) {
        if (state.arguments) {
          this.onToolCallComplete.invoke({
            type: "toolCallComplete",
            seq: this.seq++,
            callId: state.id,
            arguments: state.arguments,
          });
        }
      }
    }
  }

  processChunk(chunk: string): void {
    this.orParser.processChunk(chunk);
  }

  finalize(): void {
    // Emit complete for any remaining tool calls not yet emitted
    for (const [, state] of this.toolCalls) {
      if (state.arguments && state.started) {
        this.onToolCallComplete.invoke({
          type: "toolCallComplete",
          seq: this.seq++,
          callId: state.id,
          arguments: state.arguments,
        });
      }
    }
    this.toolCalls.clear();
  }
}
