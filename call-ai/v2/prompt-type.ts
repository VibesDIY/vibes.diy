import { type } from "arktype";
import { CoercedDate } from "./types.js";

// Message roles
export const MessageRole = type("'system' | 'user' | 'assistant'");
export type MessageRole = typeof MessageRole.infer;

// Chat message structure
export const ChatMessage = type({
  role: MessageRole,
  content: "string",
});
export type ChatMessage = typeof ChatMessage.infer;

// LLM request body (OpenRouter/OpenAI compatible)
export const LLMRequest = type({
  model: "string",
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

// Prompt message box type
export const PromptMsg = type({
  type: "'prompt.txt'",
  streamId: "string",
  request: LLMRequest,
  timestamp: CoercedDate,
});
export type PromptMsg = typeof PromptMsg.infer;

// Type guard with optional streamId filter
export const isPromptMsg = (msg: unknown, streamId?: string): msg is PromptMsg =>
  !(PromptMsg(msg) instanceof type.errors) && (!streamId || (msg as PromptMsg).streamId === streamId);
