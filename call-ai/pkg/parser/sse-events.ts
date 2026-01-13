import { type } from "arktype";

/**
 * SSE Parser Events - Arktype schemas for SSEDataParser
 *
 * Namespaced as "sse.*" for SSE parsing layer
 */

// Data payload event (non-[DONE] data lines)
export const sseData = type({
  type: "'sse.data'",
  lineNr: "number",
  payload: "string",
});

// Done event ([DONE] marker received)
export const sseDone = type({
  type: "'sse.done'",
  lineNr: "number",
});

// Union of all SSE events
export const sseEvent = sseData.or(sseDone);

export type SseEvent = typeof sseEvent.infer;
export type SseData = typeof sseData.infer;
export type SseDone = typeof sseDone.infer;

export function isSseEventError(result: unknown): boolean {
  return result instanceof type.errors;
}
