import { OnFunc } from "@adviser/cement";
import { createBaseParser } from "../parser/create-base-parser.js";
import { StreamEvent } from "./events.js";

export interface ProcessPromptParams {
  prompt: string;
  model: string;
  inputStream: ReadableStream<Uint8Array>;
}

export class StreamConverter {
  readonly register = OnFunc<(event: StreamEvent) => void>();

  async processPrompt(params: ProcessPromptParams): Promise<void> {
    const { prompt, inputStream } = params;
    const parser = createBaseParser();
    const streamId = crypto.randomUUID();

    // Wire up parser events -> unified register callback
    parser.onMeta((meta) => {
      this.register.invoke({
        type: "call-ai.stream-begin",
        streamId,
        prompt,
        model: meta.model,
        provider: meta.provider,
        created: meta.created,
      });
    });

    parser.onDelta((delta) => {
      this.register.invoke({
        type: "call-ai.stream-delta",
        streamId,
        seq: delta.seq,
        content: delta.content,
      });
    });

    parser.onUsage((usage) => {
      this.register.invoke({
        type: "call-ai.stream-usage",
        streamId,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        cost: usage.cost,
      });
    });

    parser.onDone((done) => {
      this.register.invoke({
        type: "call-ai.stream-end",
        streamId,
        finishReason: done.finishReason,
      });
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
