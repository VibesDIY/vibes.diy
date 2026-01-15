/**
 * Streaming handler using VibesStream for live segment parsing
 */

import {
  type Message,
  type Segment,
  VibesStream,
  type VibesEvent,
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

  // Track final result from vibes.end event
  let finalResult: { text: string; segments: readonly Segment[] } | null = null;
  let streamError: Error | null = null;
  let updateCount = 0;
  let lastTextLength = 0;

  const stream = new VibesStream();

  stream.onEvent((evt: VibesEvent) => {
    switch (evt.type) {
      case "vibes.update":
        updateCount++;
        lastTextLength = evt.text.length;
        onUpdate({ text: evt.text, segments: evt.segments });
        break;
      case "vibes.end":
        finalResult = { text: evt.text, segments: evt.segments };
        break;
      case "vibes.error":
        streamError = new Error(evt.message);
        if (evt.status) {
          (streamError as Error & { status?: number }).status = evt.status;
        }
        break;
    }
  });

  try {
    await stream.process({
      prompt: messages,
      chatUrl: VibesDiyEnv.CALLAI_ENDPOINT().replace(/\/+$/, ""),
      apiKey: apiKey,
      model: model,
      maxTokens: defaultMaxTokens,
      headers: {
        "HTTP-Referer": "https://vibes.diy",
        "X-Title": "Vibes DIY",
      },
    });

    // Check for errors captured via vibes.error event
    if (streamError) {
      throw streamError;
    }

    if (!finalResult) {
      throw new Error(
        `Stream completed without vibes.end event (updates: ${updateCount}, lastTextLength: ${lastTextLength})`,
      );
    }

    return finalResult;
  } catch (error) {
    // Prefer streamError if it exists (more specific than process rejection)
    const effectiveError = streamError || error;
    console.error("streamVibes error:", effectiveError);
    const errorMsg =
      effectiveError instanceof Error
        ? effectiveError.message
        : String(effectiveError);

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
