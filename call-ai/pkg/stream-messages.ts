/**
 * Semantic message types for AI stream parsing
 *
 * These types define the structured events emitted by the AIStreamParser
 * as it processes SSE streams from LLM providers (via OpenRouter).
 *
 * Follows Fireproof message conventions (camelCase, dotted type namespaces).
 */

import { z } from "zod";
import { Lazy } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";

const sthis = Lazy(() => ensureSuperThis());

// =============================================================================
// Base Message Schema (Fireproof-aligned)
// =============================================================================

/**
 * Base message envelope for all stream events
 *
 * @property src - OpenRouter model ID (e.g., "openai/gpt-4o", "anthropic/claude-3.5-sonnet")
 * @property dst - Connection ID for reconnect/rebuffering
 * @property ttl - Time-to-live for loop prevention in message routing
 * @property type - Discriminator (e.g., "callai.code.fragment")
 * @property payload - Type-specific payload
 */
export const MsgBaseSchema = <T extends z.ZodTypeAny>(payloadSchema: T) =>
  z.object({
    src: z.string(),
    dst: z.string(),
    ttl: z.number().int().nonnegative(),
    type: z.string(),
    payload: payloadSchema,
  });

export interface MsgBase<T> {
  readonly src: string;
  readonly dst: string;
  readonly ttl: number;
  readonly type: string;
  readonly payload: T;
}

// =============================================================================
// Stream Lifecycle Events
// =============================================================================

export const StreamStartPayloadSchema = z.object({
  streamId: z.number(),
  model: z.string(),
  timestamp: z.number(),
});
export type StreamStartPayload = z.infer<typeof StreamStartPayloadSchema>;

export const StreamEndPayloadSchema = z.object({
  streamId: z.number(),
  finishReason: z.enum(["stop", "length", "tool_calls", "content_filter", "error"]),
  timestamp: z.number(),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })
    .optional(),
});
export type StreamEndPayload = z.infer<typeof StreamEndPayloadSchema>;

export const StreamErrorPayloadSchema = z.object({
  streamId: z.number(),
  message: z.string(),
  code: z.string().optional(),
  recoverable: z.boolean(),
  timestamp: z.number(),
});
export type StreamErrorPayload = z.infer<typeof StreamErrorPayloadSchema>;

// =============================================================================
// Text Content Events
// =============================================================================

export const TextFragmentPayloadSchema = z.object({
  streamId: z.number(),
  seq: z.string(),
  frag: z.string(),
});
export type TextFragmentPayload = z.infer<typeof TextFragmentPayloadSchema>;

export const TextCompletePayloadSchema = z.object({
  streamId: z.number(),
  content: z.string(),
});
export type TextCompletePayload = z.infer<typeof TextCompletePayloadSchema>;

// =============================================================================
// Code Block Events
// =============================================================================

export const CodeStartPayloadSchema = z.object({
  streamId: z.number(),
  blockId: z.string(),
  language: z.string().optional(),
  seq: z.string(),
});
export type CodeStartPayload = z.infer<typeof CodeStartPayloadSchema>;

export const CodeFragmentPayloadSchema = z.object({
  streamId: z.number(),
  blockId: z.string(),
  seq: z.string(),
  frag: z.string(),
});
export type CodeFragmentPayload = z.infer<typeof CodeFragmentPayloadSchema>;

/**
 * Code end payload - lightweight signal that streaming is complete
 * Emitted after the last CODE_FRAGMENT for a block
 */
export const CodeEndPayloadSchema = z.object({
  streamId: z.number(),
  blockId: z.string(),
  language: z.string().optional(),
});
export type CodeEndPayload = z.infer<typeof CodeEndPayloadSchema>;

/**
 * Code full payload - complete code block content
 * Used for initial generation or full replacement
 */
export const CodeFullPayloadSchema = z.object({
  streamId: z.number(),
  blockId: z.string(),
  language: z.string().optional(),
  block: z.string(),
});
export type CodeFullPayload = z.infer<typeof CodeFullPayloadSchema>;

/**
 * Targeted edit operation (Claude str_replace style)
 * Uses exact string matching for surgical code changes
 */
const EditOperationSchema = z.object({
  oldStr: z.string(),
  newStr: z.string(),
});

/**
 * Code edit payload (Claude str_replace style)
 * Uses exact string matching for targeted edits
 */
export const CodeEditPayloadSchema = z.object({
  streamId: z.number(),
  blockId: z.string(),
  language: z.string().optional(),
  edits: z.array(EditOperationSchema),
});
export type CodeEditPayload = z.infer<typeof CodeEditPayloadSchema>;

// =============================================================================
// Image Events
// =============================================================================

export const ImgPayloadSchema = z.object({
  streamId: z.number(),
  url: z.string().optional(),
  base64: z.string().optional(),
  revisedPrompt: z.string().optional(),
});
export type ImgPayload = z.infer<typeof ImgPayloadSchema>;

// =============================================================================
// Message Type Constants (lowercase dotted format)
// =============================================================================

export const StreamTypes = {
  STREAM_START: "callai.stream.start",
  STREAM_END: "callai.stream.end",
  STREAM_ERROR: "callai.stream.error",
  TEXT_FRAGMENT: "callai.text.fragment",
  TEXT_COMPLETE: "callai.text.complete",
  CODE_START: "callai.code.start",
  CODE_FRAGMENT: "callai.code.fragment",
  CODE_END: "callai.code.end",
  CODE_FULL: "callai.code.full",
  CODE_EDIT: "callai.code.edit",
  IMG: "callai.img",
} as const;

export type StreamType = (typeof StreamTypes)[keyof typeof StreamTypes];

// =============================================================================
// Full Message Schemas
// =============================================================================

export const StreamStartMsgSchema = MsgBaseSchema(StreamStartPayloadSchema).extend({
  type: z.literal(StreamTypes.STREAM_START),
});

export const StreamEndMsgSchema = MsgBaseSchema(StreamEndPayloadSchema).extend({
  type: z.literal(StreamTypes.STREAM_END),
});

export const StreamErrorMsgSchema = MsgBaseSchema(StreamErrorPayloadSchema).extend({
  type: z.literal(StreamTypes.STREAM_ERROR),
});

export const TextFragmentMsgSchema = MsgBaseSchema(TextFragmentPayloadSchema).extend({
  type: z.literal(StreamTypes.TEXT_FRAGMENT),
});

export const TextCompleteMsgSchema = MsgBaseSchema(TextCompletePayloadSchema).extend({
  type: z.literal(StreamTypes.TEXT_COMPLETE),
});

export const CodeStartMsgSchema = MsgBaseSchema(CodeStartPayloadSchema).extend({
  type: z.literal(StreamTypes.CODE_START),
});

export const CodeFragmentMsgSchema = MsgBaseSchema(CodeFragmentPayloadSchema).extend({
  type: z.literal(StreamTypes.CODE_FRAGMENT),
});

export const CodeEndMsgSchema = MsgBaseSchema(CodeEndPayloadSchema).extend({
  type: z.literal(StreamTypes.CODE_END),
});

export const CodeFullMsgSchema = MsgBaseSchema(CodeFullPayloadSchema).extend({
  type: z.literal(StreamTypes.CODE_FULL),
});

export const CodeEditMsgSchema = MsgBaseSchema(CodeEditPayloadSchema).extend({
  type: z.literal(StreamTypes.CODE_EDIT),
});

export const ImgMsgSchema = MsgBaseSchema(ImgPayloadSchema).extend({
  type: z.literal(StreamTypes.IMG),
});

// =============================================================================
// Discriminated Union
// =============================================================================

export const StreamMessageSchema = z.discriminatedUnion("type", [
  StreamStartMsgSchema,
  StreamEndMsgSchema,
  StreamErrorMsgSchema,
  TextFragmentMsgSchema,
  TextCompleteMsgSchema,
  CodeStartMsgSchema,
  CodeFragmentMsgSchema,
  CodeEndMsgSchema,
  CodeFullMsgSchema,
  CodeEditMsgSchema,
  ImgMsgSchema,
]);

export type StreamMessage = z.infer<typeof StreamMessageSchema>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a unique string ID using cement's ID generator
 */
export function nextId(prefix = "id"): string {
  return `${prefix}_${sthis().nextId().str}`;
}

/**
 * Generate a unique numeric stream ID
 */
let streamCounter = 0;
export function nextStreamId(): number {
  return ++streamCounter;
}

export function createMessage<T extends StreamMessage["type"]>(
  type: T,
  src: string,
  dst: string,
  payload: Extract<StreamMessage, { type: T }>["payload"],
  ttl = 3,
): Extract<StreamMessage, { type: T }> {
  return { type, src, dst, ttl, payload } as Extract<StreamMessage, { type: T }>;
}

export function isMessageType<T extends StreamMessage["type"]>(
  msg: StreamMessage,
  type: T,
): msg is Extract<StreamMessage, { type: T }> {
  return msg.type === type;
}
