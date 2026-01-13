import { type } from "arktype";

/**
 * Line Parser Events - Arktype schemas for LineStreamParser
 *
 * Namespaced as "line.*" for line parsing layer
 */

// Fragment event - emitted in WaitingForEOL mode for line chunks
export const lineFragment = type({
  type: "'line.fragment'",
  lineNr: "number",
  seq: "number",
  fragment: "string",
  lineComplete: "boolean",
});

// Bracket open event - emitted when { is found (bracket modes)
export const lineBracketOpen = type({
  type: "'line.bracket.open'",
});

// Bracket close event - emitted when } closes the block (bracket modes)
export const lineBracketClose = type({
  type: "'line.bracket.close'",
});

// Content event - emitted for content within brackets
export const lineContent = type({
  type: "'line.content'",
  block: "number",
  seq: "number",
  seqStyle: "'first' | 'last' | 'middle'",
  content: "string",
});

// Union of all line events
export const lineEvent = lineFragment.or(lineBracketOpen).or(lineBracketClose).or(lineContent);

export type LineEvent = typeof lineEvent.infer;
export type LineFragment = typeof lineFragment.infer;
export type LineBracketOpen = typeof lineBracketOpen.infer;
export type LineBracketClose = typeof lineBracketClose.infer;
export type LineContent = typeof lineContent.infer;

export function isLineEventError(result: unknown): boolean {
  return result instanceof type.errors;
}
