import { CoercedDate, LLMRequest } from "@vibes.diy/call-ai-v2";
import { type } from "arktype";
import { vibeFile } from "./common.js";

export const PromptBase = type({
  streamId: "string",
  chatId: "string",
  seq: "number",
  timestamp: CoercedDate,
});

// Prompt message box type
export const PromptReq = type({
  type: "'prompt.req'",
  request: LLMRequest,
}).and(PromptBase);
export type PromptReq = typeof PromptReq.infer;

export function isPromptReq(msg: unknown): msg is PromptReq {
  return !(PromptReq(msg) instanceof type.errors);
}

// export const PromptFSUpdate = type({
//   type: "'prompt.fs-update'",
//   FSUpdate: FSUpdate,
// }).and(PromptBase);
// export type PromptFSUpdate = typeof PromptFSUpdate.infer;

// export function isPromptFSUpdate(msg: unknown): msg is PromptFSUpdate {
//   return !(PromptFSUpdate(msg) instanceof type.errors);
// }

export const PromptFS = type({
  type: "'prompt.fs'",
  fileSystem: vibeFile.array(), // array of fs to set - will replace existing filesystem
}).and(PromptBase);
export type PromptFS = typeof PromptFS.infer;

export function isPromptFSSet(msg: unknown): msg is PromptFS {
  return !(PromptFS(msg) instanceof type.errors);
}

export const PromptBlockBegin = type({
  type: "'prompt.block-begin'",
}).and(PromptBase);

export type PromptBlockBegin = typeof PromptBlockBegin.infer;

export const PromptError = type({
  type: "'prompt.error'",
  error: "string",
}).and(PromptBase);

export type PromptError = typeof PromptError.infer;

export function isPromptError(msg: unknown): msg is PromptError {
  return !(PromptError(msg) instanceof type.errors);
}

export const PromptBlockEnd = type({
  type: "'prompt.block-end'",
}).and(PromptBase);

export type PromptBlockEnd = typeof PromptBlockEnd.infer;

// Post-dispatch signal carrying the model the turn was ACTUALLY dispatched
// with — i.e. after `dispatchLlmRequestWithFallback` may have swapped in a
// catalog fallback following retryable primary failures. The pre-dispatch
// `prompt.req` echo records the *intended* model and is already streamed by
// the time any fallback runs, so it can be stale; clients prefer this value
// when present. Purely informational/observability (VibesDIY/vibes.diy#2628)
// — reconstruction only reads `request.messages`.
export const PromptModelResolved = type({
  type: "'prompt.model-resolved'",
  model: "string",
}).and(PromptBase);

export type PromptModelResolved = typeof PromptModelResolved.infer;

export function isPromptModelResolved(msg: unknown): msg is PromptModelResolved {
  return !(PromptModelResolved(msg) instanceof type.errors);
}

// Byte-faithful capture of the model's raw output for a turn: the concatenated
// delta text exactly as the model streamed it, BEFORE the block parser ran.
// Persisted once per turn so debugging can replay the true transcript —
// including consumed filename labels and separator blank lines the block
// parser drops — which a block-faithful reconstruction can't recover (it's
// downstream of the parser, so it inherits the parser's decisions rather than
// revealing them). See VibesDIY/vibes.diy#2655. `text` is the whole turn's
// markdown; on a recovery continuation it is the kept safe-cut prefix of each
// aborted stream stitched to the continuation that replaced it.
export const PromptRaw = type({
  type: "'prompt.raw'",
  text: "string",
}).and(PromptBase);

export type PromptRaw = typeof PromptRaw.infer;

export function isPromptRaw(msg: unknown): msg is PromptRaw {
  return !(PromptRaw(msg) instanceof type.errors);
}

// Single-block payload emitted on a dryRun:true request. Rides on the
// section stream framed by the existing block-begin/-end pair so the
// client narrows on msg.type just like any other event. Carries the
// assembled LLMRequest under `request` — same shape as PromptReq.request
// — so tooling that walks block events with `msg.request.messages` reads
// real and dry-run turns identically. Discriminator is `type`.
export const PromptDryRunPayload = type({
  type: "'prompt.dry-run-payload'",
  request: LLMRequest,
}).and(PromptBase);

export type PromptDryRunPayload = typeof PromptDryRunPayload.infer;

export function isPromptDryRunPayload(msg: unknown): msg is PromptDryRunPayload {
  return !(PromptDryRunPayload(msg) instanceof type.errors);
}

export const PromptMsgs = PromptBlockBegin.or(PromptBlockEnd)
  .or(PromptReq)
  .or(PromptError)
  .or(PromptFS)
  .or(PromptDryRunPayload)
  .or(PromptModelResolved)
  .or(PromptRaw);
export type PromptMsgs = typeof PromptMsgs.infer;

// Type guard with optional streamId filter
export const isPromptMsg = (msg: unknown): msg is PromptMsgs => !(PromptMsgs(msg) instanceof type.errors); // && (!streamId || (msg as PromptReq).streamId === streamId);

export function isPromptBlockBegin(msg: unknown): msg is PromptBlockBegin {
  return !(PromptBlockBegin(msg) instanceof type.errors);
}

export function isPromptBlockEnd(msg: unknown, streamId?: string): msg is PromptBlockEnd {
  if (PromptBlockEnd(msg) instanceof type.errors) return false;
  return !streamId || (msg as PromptBlockEnd).streamId === streamId;
}
