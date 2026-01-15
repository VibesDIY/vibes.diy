/**
 * ParserEvento - Event-driven parser using evento pattern with arktype validation.
 *
 * This module provides:
 * - Arktype schemas for all parser events
 * - ParserEvento class for event bus with handler registration
 * - Handler interface with validate/handle pattern
 */

import { type } from "arktype";
import { OnFunc } from "@adviser/cement";

// Arktype event schemas
export const orJson = type({
  type: "'or.json'",
  json: "unknown",
});

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

export const orImage = type({
  type: "'or.image'",
  index: "number",
  b64_json: "string | undefined",
  url: "string | undefined",
});

// Tool call events
export const toolStart = type({
  type: "'tool.start'",
  index: "number",
  callId: "string",
  "functionName?": "string",
});

export const toolArguments = type({
  type: "'tool.arguments'",
  index: "number",
  fragment: "string",
});

export const toolComplete = type({
  type: "'tool.complete'",
  callId: "string",
  "functionName?": "string",
  arguments: "string",
});

// Code block events
export const textFragment = type({
  type: "'textFragment'",
  seq: "number",
  fragment: "string",
});

export const codeStart = type({
  type: "'codeStart'",
  seq: "number",
  blockId: "string",
  "language?": "string",
});

export const codeFragment = type({
  type: "'codeFragment'",
  seq: "number",
  blockId: "string",
  fragment: "string",
});

export const codeEnd = type({
  type: "'codeEnd'",
  seq: "number",
  blockId: "string",
});

// Union of all parser events
export const parserEvent = orJson
  .or(orMeta)
  .or(orDelta)
  .or(orUsage)
  .or(orDone)
  .or(orStreamEnd)
  .or(orImage)
  .or(toolStart)
  .or(toolArguments)
  .or(toolComplete)
  .or(textFragment)
  .or(codeStart)
  .or(codeFragment)
  .or(codeEnd);

// Type exports
export type OrJson = typeof orJson.infer;
export type OrMeta = typeof orMeta.infer;
export type OrDelta = typeof orDelta.infer;
export type OrUsage = typeof orUsage.infer;
export type OrDone = typeof orDone.infer;
export type OrStreamEnd = typeof orStreamEnd.infer;
export type OrImage = typeof orImage.infer;
export type ToolStart = typeof toolStart.infer;
export type ToolArguments = typeof toolArguments.infer;
export type ToolComplete = typeof toolComplete.infer;
export type TextFragment = typeof textFragment.infer;
export type CodeStart = typeof codeStart.infer;
export type CodeFragment = typeof codeFragment.infer;
export type CodeEnd = typeof codeEnd.infer;
export type ParserEvent = typeof parserEvent.infer;

// Helper to check if arktype validation failed
export function isParserEventError(result: unknown): boolean {
  return result instanceof type.errors;
}

// Option type for validation results
export type ValidateResult<T> = { some: T } | { none: true };

// Handler context passed to handle function
export interface HandlerContext {
  event: ParserEvent;
  emit: (event: ParserEvent) => void;
}

// Handler interface
export interface ParserHandler {
  hash: string;
  validate: (event: ParserEvent) => ValidateResult<ParserEvent>;
  handle: (ctx: HandlerContext) => void;
}

/**
 * ParserEvento - Central event bus for parser events.
 *
 * Usage:
 * ```typescript
 * const evento = new ParserEvento();
 * evento.push({
 *   hash: "image-extractor",
 *   validate: (event) => event.type === "or.json" ? { some: event } : { none: true },
 *   handle: (ctx) => {
 *     // Extract images and emit them
 *     ctx.emit({ type: "or.image", index: 0, b64_json: "..." });
 *   }
 * });
 *
 * evento.onEvent((event) => console.log(event));
 * evento.trigger({ type: "or.json", json: { data: [] } });
 * ```
 */
export class ParserEvento {
  readonly onEvent = OnFunc<(event: ParserEvent) => void>();
  private handlers: ParserHandler[] = [];

  /**
   * Register one or more handlers.
   */
  push(...handlers: ParserHandler[]): void {
    this.handlers.push(...handlers);
  }

  /**
   * Trigger an event, dispatching to all matching handlers.
   * Events are also emitted to onEvent subscribers.
   */
  trigger(event: ParserEvent): void {
    // Always emit the original event to subscribers
    this.onEvent.invoke(event);

    // Create emit function for handlers to emit derived events
    const emit = (derivedEvent: ParserEvent) => {
      this.onEvent.invoke(derivedEvent);
    };

    // Call each handler whose validate returns { some: ... }
    for (const handler of this.handlers) {
      const result = handler.validate(event);
      if ("some" in result) {
        const ctx: HandlerContext = {
          event: result.some,
          emit,
        };
        handler.handle(ctx);
      }
    }
  }
}
