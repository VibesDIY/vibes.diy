/**
 * callVibes - Streaming API for vibes.diy code generation
 *
 * Similar to callAI but yields { text, segments } for live preview rendering.
 */

import { CallAIOptions, Message, CallAIError } from "./types.js";
import { createVibesParser, Segment } from "./parser/index.js";
import { keyStore, globalDebug } from "./key-management.js";
import { callAiFetch, joinUrlParts } from "./utils.js";
import { callAiEnv } from "./env.js";
import { PACKAGE_VERSION } from "./non-streaming.js";

/**
 * Result yielded on each chunk
 */
export interface VibesStreamResult {
  /** Full accumulated text (for storage) */
  text: string;
  /** Live segments array (for rendering) */
  segments: readonly Segment[];
}

/**
 * Stream AI responses with live segment parsing for vibes.diy
 *
 * @param prompt - User prompt as string or array of message objects
 * @param options - Configuration options (model, apiKey, chatUrl, etc.)
 * @yields VibesStreamResult with accumulated text and parsed segments
 *
 * @example
 * ```typescript
 * for await (const { text, segments } of callVibes(messages, options)) {
 *   // text: full accumulated string for database storage
 *   // segments: Segment[] for live preview rendering
 *   setAiMessage({ text });
 *   setSegments(segments);
 * }
 * ```
 */
export async function* callVibes(
  prompt: string | Message[],
  options: CallAIOptions = {},
): AsyncGenerator<VibesStreamResult, VibesStreamResult, unknown> {
  const debug = options.debug || globalDebug;

  // Get API key
  const apiKey = options.apiKey || keyStore().current || callAiEnv.CALLAI_API_KEY;
  if (!apiKey) {
    throw new CallAIError({
      message: "API key is required",
      status: 401,
      errorType: "authentication_error",
    });
  }

  // Build endpoint URL
  const customChatOrigin = options.chatUrl || callAiEnv.def.CALLAI_CHAT_URL || null;
  const endpoint =
    options.endpoint ||
    (customChatOrigin
      ? joinUrlParts(customChatOrigin, "/api/v1/chat/completions")
      : "https://openrouter.ai/api/v1/chat/completions");

  // Build messages array
  const messages: Message[] = Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt }];

  // Build request body
  const requestParams: Record<string, unknown> = {
    model: options.model || "openrouter/auto",
    messages,
    stream: true,
    provider: { sort: "latency" },
  };

  if (options.temperature !== undefined) {
    requestParams.temperature = options.temperature;
  }
  if (options.topP !== undefined) {
    requestParams.top_p = options.topP;
  }
  if (options.maxTokens !== undefined) {
    requestParams.max_tokens = options.maxTokens;
  }
  if (options.stop) {
    requestParams.stop = Array.isArray(options.stop) ? options.stop : [options.stop];
  }

  // Build headers
  const headers = new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": options.referer || "https://vibes.diy",
    "X-Title": options.title || "Vibes",
  });

  if (options.headers) {
    const extra = new Headers(options.headers as HeadersInit);
    extra.forEach((value, key) => headers.set(key, value));
  }

  if (debug) {
    console.log(`[callVibes:${PACKAGE_VERSION}] Fetching: ${endpoint}`);
    console.log(`[callVibes:${PACKAGE_VERSION}] Model: ${requestParams.model}`);
  }

  // Make the request
  const response = await callAiFetch(options)(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestParams),
  });

  // Check for errors
  if (!response.ok || response.status >= 400) {
    const errorBody = await response.text();
    let errorMessage = `API error: ${response.status} ${response.statusText}`;

    try {
      const errorJson = JSON.parse(errorBody);
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      } else if (errorJson.error && typeof errorJson.error === "string") {
        errorMessage = errorJson.error;
      } else if (errorJson.message) {
        errorMessage = errorJson.message;
      }
    } catch {
      if (errorBody.trim()) {
        errorMessage = errorBody.length > 100 ? errorBody.substring(0, 100) + "..." : errorBody;
      }
    }

    throw new CallAIError({
      message: errorMessage,
      status: response.status,
      statusText: response.statusText,
    });
  }

  // Create parser and stream
  const parser = createVibesParser();
  const reader = response.body?.getReader();

  if (!reader) {
    throw new CallAIError({
      message: "No response body",
      status: 500,
    });
  }

  const decoder = new TextDecoder();
  let accumulatedText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        // Flush decoder and finalize parser
        const finalChunk = decoder.decode(undefined, { stream: false });
        if (finalChunk) {
          parser.processChunk(finalChunk);
        }
        parser.finalize();

        // Rebuild final text after finalize
        accumulatedText = parser.segments
          .map((s) => {
            if (s.type === "markdown") {
              return s.content;
            } else {
              return "```\n" + s.content + "\n```";
            }
          })
          .join("");
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      parser.processChunk(chunk);

      // Rebuild accumulated text from segments
      accumulatedText = parser.segments
        .map((s) => {
          if (s.type === "markdown") {
            return s.content;
          } else {
            return "```\n" + s.content + "\n```";
          }
        })
        .join("");

      yield {
        text: accumulatedText,
        segments: parser.segments,
      };
    }
  } finally {
    reader.releaseLock();
  }

  return {
    text: accumulatedText,
    segments: parser.segments,
  };
}
