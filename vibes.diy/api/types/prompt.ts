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

// Recovery orchestrator events. Emitted around a continuation LLM call when
// the server detects a mid-stream apply error and re-prompts with the
// resolved-so-far state. Both web and CLI clients see these inline in the
// same outgoing block stream and can choose to render them.
export const PromptRecoveryFailedSection = type({
  path: "string",
  search: "string",
  reason: "string",
});
export type PromptRecoveryFailedSection = typeof PromptRecoveryFailedSection.infer;

export const PromptRecoveryStart = type({
  type: "'prompt.recovery.start'",
  reason: "'apply-error'",
  failedSection: PromptRecoveryFailedSection,
}).and(PromptBase);
export type PromptRecoveryStart = typeof PromptRecoveryStart.infer;

export const PromptRecoveryEnd = type({
  type: "'prompt.recovery.end'",
}).and(PromptBase);
export type PromptRecoveryEnd = typeof PromptRecoveryEnd.infer;

export const PromptRecoveryExhausted = type({
  type: "'prompt.recovery.exhausted'",
  reason: "'apply-error'",
  attempts: "number",
}).and(PromptBase);
export type PromptRecoveryExhausted = typeof PromptRecoveryExhausted.infer;

export function isPromptRecoveryStart(msg: unknown): msg is PromptRecoveryStart {
  return !(PromptRecoveryStart(msg) instanceof type.errors);
}
export function isPromptRecoveryEnd(msg: unknown): msg is PromptRecoveryEnd {
  return !(PromptRecoveryEnd(msg) instanceof type.errors);
}
export function isPromptRecoveryExhausted(msg: unknown): msg is PromptRecoveryExhausted {
  return !(PromptRecoveryExhausted(msg) instanceof type.errors);
}

export const PromptMsgs = PromptBlockBegin.or(PromptBlockEnd)
  .or(PromptReq)
  .or(PromptError)
  .or(PromptFS)
  .or(PromptRecoveryStart)
  .or(PromptRecoveryEnd)
  .or(PromptRecoveryExhausted);
export type PromptMsgs = typeof PromptMsgs.infer;

// Type guard with optional streamId filter
export const isPromptMsg = (msg: unknown): msg is PromptMsgs => !(PromptMsgs(msg) instanceof type.errors); // && (!streamId || (msg as PromptReq).streamId === streamId);

export function isPromptBlockBegin(msg: unknown): msg is PromptBlockBegin {
  return !(PromptBlockBegin(msg) instanceof type.errors);
}

export function isPromptBlockEnd(msg: unknown): msg is PromptBlockEnd {
  return !(PromptBlockEnd(msg) instanceof type.errors);
}
