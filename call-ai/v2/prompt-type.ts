import { type } from "arktype";

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
  "logprobs?": "boolean",
  "top_logsprobs?": "number",
  "frequency_penalty?": "number",
  "presence_penalty?": "number",
  "stop?": "string | string[]",
  "verbosity?": "'low' | 'medium' | 'high' | 'max'",
});

export type LLMRequest = typeof LLMRequest.infer;

// Type guards
export const isMessageRole = (msg: unknown): msg is MessageRole => !(MessageRole(msg) instanceof type.errors);

export const isChatMessage = (msg: unknown): msg is ChatMessage => !(ChatMessage(msg) instanceof type.errors);

export const isLLMRequest = (msg: unknown): msg is LLMRequest => !(LLMRequest(msg) instanceof type.errors);
