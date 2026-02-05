import { type } from "arktype";
import { CoercedDate } from "./types.js";

// Message roles
export const MessageRole = type("'system' | 'user' | 'assistant'");
export type MessageRole = typeof MessageRole.infer;

export const TextContent = type({
  type: "'text'",
  text: "string",
});
export type TextContent = typeof TextContent.infer;

// Chat message structure
export const ChatMessage = type({
  role: MessageRole,
  content: TextContent.array(),
});
export type ChatMessage = typeof ChatMessage.infer;

// LLM request body (OpenRouter/OpenAI compatible)
export const LLMRequest = type({
  "model?": "string",
  messages: [ChatMessage, "[]"],
  "stream?": "boolean",
  "temperature?": "number",
  "max_tokens?": "number",
  "top_p?": "number",
  "frequency_penalty?": "number",
  "presence_penalty?": "number",
  "stop?": "string | string[]",
});

export type LLMRequest = typeof LLMRequest.infer;

// Type guards
export const isMessageRole = (msg: unknown): msg is MessageRole => !(MessageRole(msg) instanceof type.errors);

export const isChatMessage = (msg: unknown): msg is ChatMessage => !(ChatMessage(msg) instanceof type.errors);

export const isLLMRequest = (msg: unknown): msg is LLMRequest => !(LLMRequest(msg) instanceof type.errors);

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

export const PromptBlockBegin = type({
  type: "'prompt.block-begin'",
}).and(PromptBase);

export type PromptBlockBegin = typeof PromptBlockBegin.infer;

export const FileSystemRef = type({
  appSlug: "string",
  userSlug: "string",
  mode: "'production'|'dev'",
  fsId: "string",
  wrapperUrl: "string",
  entryPointUrl: "string",
});
export type FileSystemRef = typeof FileSystemRef.infer;

export const PromptBlockEnd = type({
  type: "'prompt.block-end'",
  "fsRef?": FileSystemRef,
}).and(PromptBase);

export type PromptBlockEnd = typeof PromptBlockEnd.infer;

export const PromptMsgs = PromptBlockBegin.or(PromptBlockEnd).or(PromptReq);
export type PromptMsgs = typeof PromptMsgs.infer;

// Type guard with optional streamId filter
export const isPromptMsg = (msg: unknown): msg is PromptMsgs => !(PromptMsgs(msg) instanceof type.errors); // && (!streamId || (msg as PromptReq).streamId === streamId);

export function isPromptBlockBegin(msg: unknown): msg is PromptBlockBegin {
  return !(PromptBlockBegin(msg) instanceof type.errors);
}

export function isPromptBlockEnd(msg: unknown): msg is PromptBlockEnd {
  return !(PromptBlockEnd(msg) instanceof type.errors);
}

export function isPromptReq(msg: unknown): msg is PromptReq {
  return !(PromptReq(msg) instanceof type.errors);
}
