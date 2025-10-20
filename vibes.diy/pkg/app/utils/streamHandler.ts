/**
 * Utility functions for working with AI models via call-ai library
 */

import { type CallAIOptions, type Message, callAI } from "call-ai";
import { VibesDiyEnv } from "../config/env.js";

/**
 * Stream AI responses with accumulated content callback
 *
 * @param model - The model to use (e.g. "anthropic/claude-sonnet-4.5")
 * @param systemPrompt - The system prompt
 * @param messageHistory - Array of previous messages
 * @param userMessage - The current user message
 * @param onContent - Callback function that receives the accumulated content so far
 * @param apiKey - The API key to use for the callAI service
 * @param userId - The user ID
 * @param setNeedsLogin - Optional callback to set needs login flag
 * @returns A promise that resolves to the complete response when streaming is complete
 */
export async function streamAI(
  model: string,
  systemPrompt: string,
  messageHistory: {
    role: "user" | "assistant" | "system";
    content: string;
  }[],
  userMessage: string,
  onContent: (content: string) => void,
  apiKey: string, // API key (can be dummy key for proxy)
  userId?: string,
  setNeedsLogin?: (value: boolean) => void,
): Promise<string> {
  // Stream process starts

  // Format messages for call-ai
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...messageHistory,
    { role: "user", content: userMessage },
  ];
  // Configure call-ai options with default maximum token limit
  const defaultMaxTokens = userId ? 150000 : 75000;
  const options: CallAIOptions = {
    chatUrl: VibesDiyEnv.CALLAI_ENDPOINT().replace(/\/+$/, ""), // Remove trailing slash to prevent double slash
    apiKey: apiKey, // Pass through the API key (including dummy keys)
    model: model,
    transforms: ["middle-out"],
    stream: true,
    max_tokens: defaultMaxTokens,
    debug: false, // Disable debugging logs
    headers: {
      "HTTP-Referer": "https://vibes.diy",
      "X-Title": "Vibes DIY",
      "X-VIBES-Token": localStorage.getItem("auth_token") || "",
    },
  };

  // Credit checking no longer needed - proxy handles it

  try {
    const response = await callAI(messages, options);

    // Process the stream - handle both string and StreamResponse cases
    let finalResponse = "";

    if (typeof response === "string") {
      // Handle direct string response
      finalResponse = response;
      onContent(response);
      return finalResponse;
    } else if (response && typeof response === "object") {
      // Handle StreamResponse object - assuming it's an async generator
      try {
        const generator = response as AsyncGenerator<string>;
        for await (const content of generator) {
          // Each yielded content already contains the full accumulated text
          finalResponse = content;
          onContent(content);
        }
        return finalResponse;
      } catch (streamError) {
        // Failed to even start streaming
        console.error("Streaming error:", streamError);
        const errorMsg =
          streamError instanceof Error
            ? streamError.message
            : String(streamError);

        // Check if this is an authentication error
        const isAuthError =
          errorMsg.toLowerCase().includes("authentication") ||
          errorMsg.toLowerCase().includes("401") ||
          errorMsg.toLowerCase().includes("unauthorized") ||
          errorMsg.toLowerCase().includes("authentication_error");

        if (isAuthError) {
          console.warn(
            "Auth error detected during streaming, triggering login modal",
          );
          if (setNeedsLogin) {
            setNeedsLogin(true);
          }
          throw new Error("Authentication required");
        }

        // Return error message for non-auth errors
        return `Error: ${errorMsg}. If using proxy, ensure it's running at ${VibesDiyEnv.CALLAI_ENDPOINT()}`;
      }
    } else {
      throw new Error("Unexpected response type from callAI");
    }
  } catch (initialError) {
    // Failed to even start streaming
    console.error("Initial callAI error:", initialError);
    const errorMsg =
      initialError instanceof Error
        ? initialError.message
        : String(initialError);

    // Check if this is an authentication error
    const isAuthError =
      errorMsg.toLowerCase().includes("authentication") ||
      errorMsg.toLowerCase().includes("401") ||
      errorMsg.toLowerCase().includes("unauthorized") ||
      errorMsg.toLowerCase().includes("authentication_error");

    if (isAuthError) {
      console.warn(
        "Auth error detected in initial callAI, triggering login modal",
      );
      if (setNeedsLogin) {
        setNeedsLogin(true);
      }
      throw new Error("Authentication required");
    }

    // Return error message for non-auth errors
    return `Error: ${errorMsg}. If using proxy, ensure it's running at ${VibesDiyEnv.CALLAI_ENDPOINT()}`;
  }
}
