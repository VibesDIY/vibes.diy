import { OnFunc } from "@adviser/cement";
import { OrDone, OrEventSource } from "./openrouter-events.js";

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

  private readonly orParser: OrEventSource;
  private seq = 0;

  // Support multiple parallel tool calls via index-keyed maps
  private toolCalls: Map<number, {
    id: string;
    name?: string;
    arguments: string;
    started: boolean;
    completed: boolean;
  }> = new Map();

  constructor(orParser: OrEventSource) {
    this.orParser = orParser;
    this.orParser.onEvent((evt) => {
      switch (evt.type) {
        case "or.json":
          this.handleJson(evt.json);
          break;
        case "or.done":
          this.handleDone(evt);
          break;
      }
    });
  }

  private handleJson(json: unknown): void {
    const chunk = json as Record<string, unknown>;
    // Extract tool_calls from choices[0].delta.tool_calls
    const choices = chunk.choices as Array<{delta?: {tool_calls?: Array<{index?: number; id?: string; function?: {name?: string; arguments?: string}}>}}>;
    const toolCalls = choices?.[0]?.delta?.tool_calls;

    if (toolCalls) {
      for (const tc of toolCalls) {
        const index = tc.index ?? 0;

        // Get or create tool call state
        let state = this.toolCalls.get(index);
        if (!state) {
          state = { id: tc.id || `tool-${index}`, arguments: "", started: false, completed: false };
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

  private handleDone(evt: OrDone): void {
    if (evt.finishReason === "tool_calls") {
      // Emit complete for all accumulated tool calls
      for (const [, state] of this.toolCalls) {
        this.emitCompletion(state);
      }
    }
  }

  /**
   * Process a chunk of streaming data.
   * Only available when constructed with a parser that supports processChunk (like OpenRouterParser).
   */
  processChunk(chunk: string): void {
    const parser = this.orParser as { processChunk?: (chunk: string) => void };
    if (parser.processChunk) {
      parser.processChunk(chunk);
    }
  }

  finalize(): void {
    // Emit complete for any remaining tool calls not yet emitted
    for (const [, state] of this.toolCalls) {
      this.emitCompletion(state);
    }
    this.toolCalls.clear();
  }

  private emitCompletion(state: { id: string; arguments: string; started: boolean; completed: boolean }): void {
    if (!state.started || !state.arguments || state.completed) {
      return;
    }
    state.completed = true;
    this.onToolCallComplete.invoke({
      type: "toolCallComplete",
      seq: this.seq++,
      callId: state.id,
      arguments: state.arguments,
    });
  }
}