/**
 * StreamingAdapter - Parses streaming SSE responses.
 *
 * Wraps the parser chain (LineParser → SSEParser → JsonParser)
 * and triggers appropriate events into ParserEvento.
 */

import { ParserEvento } from "../parser-evento.js";
import { LineStreamParser, LineStreamState } from "../line-stream.js";
import { SSEDataParser } from "../sse-data-parser.js";
import { SSEJsonParser } from "../json-parser.js";

type ContentBlock = { type?: string; text?: string; input?: unknown };
type Delta = {
  content?: string | ContentBlock[];
  tool_calls?: Array<{ function?: { arguments?: string } }>;
  function_call?: { arguments?: string };
};
type Choice = {
  delta?: Delta;
  text?: string;
  finish_reason?: string | null;
};
type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number };

interface ChunkData {
  id?: string;
  provider?: string;
  model?: string;
  created?: number;
  system_fingerprint?: string;
  choices?: Choice[];
  usage?: Usage;
  type?: string;
  delta?: { type?: string; text?: string };
}

export class StreamingAdapter {
  private lineParser: LineStreamParser;
  private sseParser: SSEDataParser;
  private jsonParser: SSEJsonParser;

  private seq = 0;
  private metaEmitted = false;

  constructor(private evento: ParserEvento) {
    // Set up parser chain
    this.lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    this.sseParser = new SSEDataParser(this.lineParser);
    this.jsonParser = new SSEJsonParser(this.sseParser);

    // Listen to JSON events and dispatch to evento
    this.jsonParser.onEvent((evt) => {
      if (evt.type === "json.payload") {
        this.dispatchChunk(evt.json as ChunkData);
      }
    });
  }

  processChunk(chunk: string): void {
    this.lineParser.processChunk(chunk);
  }

  private dispatchChunk(chunk: ChunkData): void {
    // Emit or.json
    this.evento.trigger({ type: "or.json", json: chunk });

    // Emit or.meta (once)
    this.emitMetaOnce(chunk);

    // Emit or.delta from choice
    this.emitDeltaFromChoice(chunk);

    // Emit or.delta from Claude content_block_delta
    this.emitDeltaFromClaudeBlock(chunk);

    // Emit or.done if finish_reason present
    this.emitDoneIfNeeded(chunk);

    // Emit legacy choice text
    this.emitLegacyChoiceText(chunk);

    // Emit or.usage if present
    this.emitUsageIfPresent(chunk);
  }

  private emitMetaOnce(chunk: ChunkData): void {
    if (this.metaEmitted || !chunk.id) {
      return;
    }

    this.evento.trigger({
      type: "or.meta",
      id: chunk.id,
      provider: chunk.provider ?? "",
      model: chunk.model ?? "",
      created: chunk.created ?? 0,
      systemFingerprint: chunk.system_fingerprint ?? "",
    });
    this.metaEmitted = true;
  }

  private emitDeltaFromChoice(chunk: ChunkData): void {
    const choices = chunk.choices;
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

  private emitDeltaFromClaudeBlock(chunk: ChunkData): void {
    if (chunk.type !== "content_block_delta") {
      return;
    }

    const delta = chunk.delta;
    if (delta?.type === "text_delta" && delta.text) {
      this.emitDelta(delta.text);
    }
  }

  private emitDoneIfNeeded(chunk: ChunkData): void {
    const choices = chunk.choices;
    const finishReason = choices?.[0]?.finish_reason;
    if (finishReason) {
      this.evento.trigger({ type: "or.done", finishReason });
    }
  }

  private emitLegacyChoiceText(chunk: ChunkData): void {
    const choices = chunk.choices;
    if (choices?.[0]?.delta) {
      return;
    }

    const legacyText = choices?.[0]?.text;
    if (legacyText) {
      this.emitDelta(legacyText);
    }
  }

  private emitUsageIfPresent(chunk: ChunkData): void {
    const usage = chunk.usage;
    if (!usage) {
      return;
    }

    this.evento.trigger({
      type: "or.usage",
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: usage.total_tokens ?? 0,
      cost: usage.cost,
    });
  }

  private emitDelta(content: string): void {
    this.evento.trigger({
      type: "or.delta",
      seq: this.seq++,
      content,
    });
  }
}
