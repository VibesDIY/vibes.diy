import { type } from "arktype";
import { CoercedDate } from "./types.js";
import { isDataBegin, isDataLine, isDataEnd, isDataStats, DataStreamMsg } from "./data-stream.js";
import { isStatsCollect } from "./stats-stream.js";
import { passthrough } from "./passthrough.js";

export const SseUsage = type({
  prompt_tokens: "number",
  completion_tokens: "number",
  total_tokens: "number",
});

export type SseUsage = typeof SseUsage.infer;

export const SSeImage = type({
  type: "string",
  index: "number",
  image_url: type({
    url: "string",
  }),
});

export const SseChunk = type({
  id: "string",
  provider: "string",
  model: "string",
  object: "string",
  created: "number",
  choices: type({
    index: "number",
    delta: {
      "role?": "string",
      "content?": "string",
      "reasoning?": "string|null",
      "reasoning_details?": "unknown[]",
      "images?": SSeImage.array(),
      "+": "delete",
    },
    finish_reason: "string|null",
    native_finish_reason: "string|null",
    "logprobs?": "unknown",
  }).array(),
  "system_fingerprint?": "string",
  "usage?": SseUsage,
  "+": "delete",
});

// Direct OpenAI format: same shape but without provider and native_finish_reason
const OpenAiDirectChunk = type({
  id: "string",
  model: "string",
  object: "string",
  created: "number",
  choices: type({
    index: "number",
    delta: {
      "role?": "string",
      "content?": "string",
      "reasoning?": "string|null",
      "reasoning_details?": "unknown[]",
      "+": "delete",
    },
    finish_reason: "string|null",
    "logprobs?": "unknown",
  }).array(),
  "system_fingerprint?": "string",
  "usage?": SseUsage,
  "+": "delete",
});

function openaiDirectToSseChunk(validated: typeof OpenAiDirectChunk.infer): SseChunk {
  return {
    ...validated,
    provider: "openai",
    choices: validated.choices.map((c) => ({
      ...c,
      native_finish_reason: c.finish_reason,
    })),
  };
}

export type SseChunk = typeof SseChunk.infer;

export const SseBeginMsg = type({
  type: "'sse.begin'",
  streamId: "string",
  timestamp: CoercedDate,
});

export const SseLineMsg = type({
  type: "'sse.line'",
  streamId: "string",
  chunk: SseChunk,
  chunkNr: "number",
  timestamp: CoercedDate,
});

export const SseEndMsg = type({
  type: "'sse.end'",
  streamId: "string",
  usages: SseUsage.array(),
  totalChunks: "number",
  totalErrors: "number",
  timestamp: CoercedDate,
});

export const SseErrorMsg = type({
  type: "'sse.error'",
  streamId: "string",
  error: "string",
  json: "unknown",
  errorNr: "number",
  timestamp: CoercedDate,
});

export const SseStatsMsg = type({
  type: "'sse.stats'",
  streamId: "string",
  stats: {
    chunkNr: "number",
    errorNr: "number",
  },
  timestamp: CoercedDate,
});

export const SseStreamMsg = SseBeginMsg.or(SseLineMsg).or(SseErrorMsg).or(SseEndMsg).or(SseStatsMsg);

export type SseBeginMsg = typeof SseBeginMsg.infer;
export type SseLineMsg = typeof SseLineMsg.infer;
export type SseErrorMsg = typeof SseErrorMsg.infer;
export type SseEndMsg = typeof SseEndMsg.infer;
export type SseStatsMsg = typeof SseStatsMsg.infer;
export type SseStreamMsg = typeof SseStreamMsg.infer;

// Type guards with optional streamId filter
export const isSseBegin = (msg: unknown, streamId?: string): msg is SseBeginMsg =>
  !(SseBeginMsg(msg) instanceof type.errors) && (!streamId || (msg as SseBeginMsg).streamId === streamId);
export const isSseLine = (msg: unknown, streamId?: string): msg is SseLineMsg =>
  !(SseLineMsg(msg) instanceof type.errors) && (!streamId || (msg as SseLineMsg).streamId === streamId);
export const isSseError = (msg: unknown, streamId?: string): msg is SseErrorMsg =>
  !(SseErrorMsg(msg) instanceof type.errors) && (!streamId || (msg as SseErrorMsg).streamId === streamId);
export const isSseEnd = (msg: unknown, streamId?: string): msg is SseEndMsg =>
  !(SseEndMsg(msg) instanceof type.errors) && (!streamId || (msg as SseEndMsg).streamId === streamId);
export const isSseStats = (msg: unknown, streamId?: string): msg is SseStatsMsg =>
  !(SseStatsMsg(msg) instanceof type.errors) && (!streamId || (msg as SseStatsMsg).streamId === streamId);
export const isSseMsg = (msg: unknown, streamId?: string): msg is SseStreamMsg =>
  !(SseStreamMsg(msg) instanceof type.errors) && (!streamId || (msg as SseStreamMsg).streamId === streamId);

// Combined output type (passthrough + own events)

// Anthropic SSE format detection and translation
// Detects events like message_start, content_block_delta, message_delta
// and translates them into OpenAI-shaped SseChunk objects

interface AnthropicState {
  id: string;
  model: string;
  created: number;
}

function isAnthropicEvent(json: unknown): json is Record<string, unknown> & { type: string } {
  return typeof json === "object" && json !== null && "type" in json && typeof json.type === "string";
}

function obj(v: unknown): Record<string, unknown> | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  return Object.fromEntries(Object.entries(v));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function anthropicToSseChunk(
  json: Record<string, unknown> & { type: string },
  state: AnthropicState
): SseChunk | "skip" | null {
  const base = () => ({
    id: state.id,
    provider: "anthropic",
    model: state.model,
    object: "chat.completion.chunk",
    created: state.created,
  });

  switch (json.type) {
    case "message_start": {
      const msg = obj(json.message);
      if (msg === undefined) return null;
      state.id = str(msg.id);
      state.model = str(msg.model);
      return {
        ...base(),
        choices: [
          {
            index: 0,
            delta: { role: str(msg.role, "assistant"), content: "" },
            finish_reason: null,
            native_finish_reason: null,
            logprobs: null,
          },
        ],
      };
    }

    case "content_block_delta": {
      const delta = obj(json.delta);
      if (delta === undefined) return "skip";
      let content: string;
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        content = delta.text;
      } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
        content = delta.partial_json;
      } else {
        return "skip";
      }
      return {
        ...base(),
        choices: [
          {
            index: 0,
            delta: { content },
            finish_reason: null,
            native_finish_reason: null,
            logprobs: null,
          },
        ],
      };
    }

    case "message_delta": {
      const delta = obj(json.delta);
      const usage = obj(json.usage);
      const chunk: SseChunk = {
        ...base(),
        choices: [
          {
            index: 0,
            delta: { content: "" },
            finish_reason: delta ? str(delta.stop_reason, "stop") : "stop",
            native_finish_reason: delta ? str(delta.stop_reason, "stop") : "stop",
            logprobs: null,
          },
        ],
      };
      if (usage) {
        const inp = num(usage.input_tokens);
        const out = num(usage.output_tokens);
        chunk.usage = { prompt_tokens: inp, completion_tokens: out, total_tokens: inp + out };
      }
      return chunk;
    }

    case "content_block_start":
    case "content_block_stop":
    case "ping":
    case "message_stop":
      return "skip";

    default:
      return null;
  }
}

export function createSseStream(filterStreamId: string): TransformStream<DataStreamMsg, SseStreamMsg> {
  let chunkNr = 0;
  let errorNr = 0;
  const usages: SseUsage[] = [];
  let streamId = "";
  const anthropicState: AnthropicState = { id: "", model: "", created: Math.floor(Date.now() / 1000) };

  return new TransformStream<DataStreamMsg, SseStreamMsg>({
    transform: passthrough((msg, controller) => {
      // Handle stats.collect trigger
      if (isStatsCollect(msg, filterStreamId)) {
        controller.enqueue({
          type: "sse.stats",
          streamId: filterStreamId,
          stats: { chunkNr, errorNr },
          timestamp: new Date(),
        });
        return;
      }

      // Passthrough data.stats
      if (isDataStats(msg, filterStreamId)) {
        return;
      }

      if (isDataBegin(msg, filterStreamId)) {
        streamId = msg.streamId;
        controller.enqueue({
          type: "sse.begin",
          streamId,
          timestamp: new Date(),
        });
      } else if (isDataLine(msg, filterStreamId)) {
        // Try OpenRouter format first (has provider + native_finish_reason)
        const result = SseChunk(msg.json);
        if (!("summary" in result)) {
          chunkNr++;
          if (result.usage) {
            usages.push(result.usage);
          }
          controller.enqueue({
            type: "sse.line",
            streamId,
            chunk: result,
            chunkNr,
            timestamp: new Date(),
          });
          return;
        }

        // Try direct OpenAI format (no provider/native_finish_reason)
        const directResult = OpenAiDirectChunk(msg.json);
        if (!("summary" in directResult)) {
          const chunk = openaiDirectToSseChunk(directResult);
          chunkNr++;
          if (chunk.usage) {
            usages.push(chunk.usage);
          }
          controller.enqueue({
            type: "sse.line",
            streamId,
            chunk,
            chunkNr,
            timestamp: new Date(),
          });
          return;
        }

        // Try Anthropic format
        if (isAnthropicEvent(msg.json)) {
          const translated = anthropicToSseChunk(msg.json, anthropicState);
          if (translated === "skip") return;
          if (translated !== null) {
            chunkNr++;
            if (translated.usage) {
              usages.push(translated.usage);
            }
            controller.enqueue({
              type: "sse.line",
              streamId,
              chunk: translated,
              chunkNr,
              timestamp: new Date(),
            });
            return;
          }
        }

        // Neither format matched
        errorNr++;
        controller.enqueue({
          type: "sse.error",
          streamId,
          error: result.summary,
          json: msg.json,
          errorNr,
          timestamp: new Date(),
        });
      } else if (isDataEnd(msg, filterStreamId)) {
        controller.enqueue({
          type: "sse.end",
          streamId,
          usages,
          totalChunks: chunkNr,
          totalErrors: errorNr,
          timestamp: new Date(),
        });
      }
    }),
  });
}
