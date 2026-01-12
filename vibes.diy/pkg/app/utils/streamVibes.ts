/**
 * Streaming handler using callVibes for live segment parsing
 */

import {
  type CallAIOptions,
  type Message,
  callVibes,
  type Segment,
} from "call-ai";
import { VibesDiyEnv } from "../config/env.js";
import { AUTH_REQUIRED_ERROR, isAuthErrorMessage } from "./authErrors.js";

/**
 * Stream AI responses with live segment parsing
 *
 * @param model - The model to use (e.g. "anthropic/claude-sonnet-4.5")
 * @param systemPrompt - The system prompt
 * @param messageHistory - Array of previous messages
 * @param userMessage - The current user message
 * @param onUpdate - Callback receiving { text, segments } on each chunk
 * @param apiKey - The API key to use
 * @param setNeedsLogin - Optional callback to set needs login flag
 * @returns Promise resolving to final { text, segments }
 */
export async function streamVibes(
  model: string,
  systemPrompt: string,
  messageHistory: {
    role: "user" | "assistant" | "system";
    content: string;
  }[],
  userMessage: string,
  onUpdate: (update: { text: string; segments: readonly Segment[] }) => void,
  apiKey: string,
  setNeedsLogin?: (value: boolean) => void,
): Promise<{ text: string; segments: readonly Segment[] }> {
  // Format messages for call-ai
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messageHistory,
    { role: "user", content: userMessage },
  ];

  // Configure call-ai options
  const defaultMaxTokens = 150000;
  const options: CallAIOptions = {
    chatUrl: VibesDiyEnv.CALLAI_ENDPOINT().replace(/\/+$/, ""),
    apiKey: apiKey,
    model: model,
    maxTokens: defaultMaxTokens,
    headers: {
      "HTTP-Referer": "https://vibes.diy",
      "X-Title": "Vibes DIY",
    },
  };

  try {
    let finalResult = { text: "", segments: [] as readonly Segment[] };

    for await (const result of callVibes(messages, options)) {
      finalResult = result;
      onUpdate(result);
    }

    return finalResult;
  } catch (error) {
    console.error("streamVibes error:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check if this is an authentication error
    if (isAuthErrorMessage(errorMsg)) {
      console.warn(
        "Auth error detected in streamVibes, triggering login modal",
      );
      if (setNeedsLogin) {
        setNeedsLogin(true);
      }
      throw new Error(AUTH_REQUIRED_ERROR);
    }

    // Re-throw all errors so callers can handle them properly
    throw error;
  }
}
