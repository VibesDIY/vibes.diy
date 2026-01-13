import { type } from "arktype";

// Namespaced as "or.*" for OpenRouter layer
export const orMeta = type({
  type: "'or.meta'",
  id: "string",
  provider: "string",
  model: "string",
  created: "number",
  systemFingerprint: "string",
});

export const orDelta = type({
  type: "'or.delta'",
  seq: "number",
  content: "string",
});

export const orUsage = type({
  type: "'or.usage'",
  promptTokens: "number",
  completionTokens: "number",
  totalTokens: "number",
  "cost?": "number",
});

export const orDone = type({
  type: "'or.done'",
  finishReason: "string",
});

export const orStreamEnd = type({
  type: "'or.stream-end'",
});

// Union of all OpenRouter events
export const orEvent = orMeta
  .or(orDelta)
  .or(orUsage)
  .or(orDone)
  .or(orStreamEnd);

export type OrEvent = typeof orEvent.infer;
export type OrMeta = typeof orMeta.infer;
export type OrDelta = typeof orDelta.infer;
export type OrUsage = typeof orUsage.infer;
export type OrDone = typeof orDone.infer;
export type OrStreamEnd = typeof orStreamEnd.infer;

// Helper to check if arktype validation failed
export function isOrEventError(result: unknown): boolean {
  return result instanceof type.errors;
}
