import { OnFunc } from "@adviser/cement";
import { OpenRouterParser } from "../parser/openrouter-parser.js";
import { ParserEvent } from "../parser/parser-evento.js";
import { StreamEvent } from "./events.js";

export interface ProcessPromptParams {
  prompt: string;
  model: string;
  inputStream: ReadableStream<Uint8Array>;
}

/**
 * Transform OpenRouter events to StreamConverter events
 */
function toStreamEvent(evt: ParserEvent, streamId: string, prompt: string): StreamEvent | null {
  switch (evt.type) {
    case "or.meta":
      return {
        type: "call-ai.stream-begin",
        streamId,
        prompt,
        model: evt.model,
        provider: evt.provider,
        created: evt.created,
      };
    case "or.delta":
      return {
        type: "call-ai.stream-delta",
        streamId,
        seq: evt.seq,
        content: evt.content,
      };
    case "or.usage":
      return {
        type: "call-ai.stream-usage",
        streamId,
        promptTokens: evt.promptTokens,
        completionTokens: evt.completionTokens,
        totalTokens: evt.totalTokens,
        cost: evt.cost,
      };
    case "or.done":
      return {
        type: "call-ai.stream-end",
        streamId,
        finishReason: evt.finishReason,
      };
    case "or.stream-end":
      return null; // Internal event, don't forward
    case "or.json":
      return null; // Raw JSON, don't forward
    default:
      return null;
  }
}

export class StreamConverter {
  readonly register = OnFunc<(event: StreamEvent) => void>();

  async processPrompt(params: ProcessPromptParams): Promise<void> {
    const { prompt, inputStream } = params;
    const parser = new OpenRouterParser();
    const streamId = crypto.randomUUID();

    // Single wiring point - transform and forward
    parser.onEvent((evt) => {
      const streamEvt = toStreamEvent(evt, streamId, prompt);
      if (streamEvt) this.register.invoke(streamEvt);
    });

    // Process the input stream
    const reader = inputStream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.processChunk(decoder.decode(value, { stream: true }));
      }
    } finally {
      reader.releaseLock();
    }
  }
}
