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

export const orJson = type({
  type: "'or.json'",
  json: "unknown",
});

export const orImage = type({
  type: "'or.image'",
  index: "number",
  b64_json: "string | undefined",
  url: "string | undefined",
});

// Union of all OpenRouter events
export const orEvent = orMeta
  .or(orDelta)
  .or(orUsage)
  .or(orDone)
  .or(orStreamEnd)
  .or(orJson)
  .or(orImage);

export type OrEvent = typeof orEvent.infer;
export type OrMeta = typeof orMeta.infer;
export type OrDelta = typeof orDelta.infer;
export type OrUsage = typeof orUsage.infer;
export type OrDone = typeof orDone.infer;
export type OrStreamEnd = typeof orStreamEnd.infer;
export type OrJson = typeof orJson.infer;
export type OrImage = typeof orImage.infer;

// Helper to check if arktype validation failed
export function isOrEventError(result: unknown): boolean {
  return result instanceof type.errors;
}

/**
 * Interface for parsers that emit OrEvents.
 * Both OpenRouterParser (streaming) and NonStreamingOpenRouterParser implement this.
 */
export interface OrEventSource {
  readonly onEvent: {
    (callback: (event: OrEvent) => void): void;
    invoke(event: OrEvent): void;
  };
}
