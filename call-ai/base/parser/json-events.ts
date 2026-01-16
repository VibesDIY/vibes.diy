import { type } from "arktype";

// Namespaced as "json.*" for raw JSON parsing layer
export const jsonPayload = type({
  type: "'json.payload'",
  lineNr: "number",
  json: "unknown",
});

export const jsonDone = type({
  type: "'json.done'",
});

// Union of all JsonParser events
export const jsonEvent = jsonPayload.or(jsonDone);

export type JsonEvent = typeof jsonEvent.infer;
export type JsonPayload = typeof jsonPayload.infer;
export type JsonDone = typeof jsonDone.infer;

// Helper to check if arktype validation failed
export function isJsonEventError(result: unknown): boolean {
  return result instanceof type.errors;
}
