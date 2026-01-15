import { type } from "arktype";

/**
 * Vibes stream events - lifecycle and content events for VibesStream
 */

const segmentType = type({
  type: "'markdown' | 'code'",
  content: "string",
});

export const vibesBegin = type({
  type: "'vibes.begin'",
  streamId: "string",
  model: "string | undefined",
});

export const vibesUpdate = type({
  type: "'vibes.update'",
  text: "string",
  segments: segmentType.array(),
});

export const vibesEnd = type({
  type: "'vibes.end'",
  streamId: "string",
  text: "string",
  segments: segmentType.array(),
  stats: {
    promptTokens: "number | undefined",
    completionTokens: "number | undefined",
    totalTokens: "number | undefined",
  },
});

export const vibesError = type({
  type: "'vibes.error'",
  message: "string",
  status: "number | undefined",
});

export const vibesEvent = vibesBegin.or(vibesUpdate).or(vibesEnd).or(vibesError);

export type VibesEvent = typeof vibesEvent.infer;
export type VibesBegin = typeof vibesBegin.infer;
export type VibesUpdate = typeof vibesUpdate.infer;
export type VibesEnd = typeof vibesEnd.infer;
export type VibesError = typeof vibesError.infer;

export function isVibesEventError(result: unknown): boolean {
  return result instanceof type.errors;
}
