import { type } from "arktype";

export const streamBegin = type({
  type: "'call-ai.stream-begin'",
  streamId: "string",
  prompt: "string",
  model: "string",
  provider: "string",
  created: "number",
});

export const streamDelta = type({
  type: "'call-ai.stream-delta'",
  streamId: "string",
  seq: "number",
  content: "string",
});

export const streamUsage = type({
  type: "'call-ai.stream-usage'",
  streamId: "string",
  promptTokens: "number",
  completionTokens: "number",
  totalTokens: "number",
  "cost?": "number",
});

export const streamEnd = type({
  type: "'call-ai.stream-end'",
  streamId: "string",
  finishReason: "string",
});

export const streamError = type({
  type: "'call-ai.stream-error'",
  streamId: "string",
  message: "string",
  "code?": "string",
});

// Union of all stream events
export const streamEvent = streamBegin
  .or(streamDelta)
  .or(streamUsage)
  .or(streamEnd)
  .or(streamError);

export type StreamEvent = typeof streamEvent.infer;
export type StreamBegin = typeof streamBegin.infer;
export type StreamDelta = typeof streamDelta.infer;
export type StreamUsage = typeof streamUsage.infer;
export type StreamEnd = typeof streamEnd.infer;
export type StreamError = typeof streamError.infer;
