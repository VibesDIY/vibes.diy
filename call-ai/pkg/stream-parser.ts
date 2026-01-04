/**
 * Stream Parser - Semantic message wrapper for AI streaming
 *
 * This module wraps callAIStreamingSemantic() and emits semantic StreamMessage events
 * for code blocks, text fragments, and lifecycle events.
 *
 * Uses callAIStreamingSemantic which processes content through detectCodeBlocks
 * and yields StreamMessage events directly.
 */

import { CallAIOptions, Message } from "./types.js";
import { callAIStreamingSemantic } from "./streaming.js";
import { StreamMessage, StreamTypes, createMessage, nextStreamId } from "./stream-messages.js";

/**
 * Parse AI streaming response into semantic messages
 *
 * Wraps callAIStreamingSemantic() and emits structured StreamMessage events for
 * code blocks, text fragments, and lifecycle events.
 *
 * @param prompt - String prompt or array of messages
 * @param options - CallAI options (apiKey, model, etc.)
 * @yields StreamMessage events
 *
 * @example
 * ```typescript
 * for await (const msg of parseAIStream("Write hello world", options)) {
 *   if (msg.type === StreamTypes.CODE_FRAGMENT) {
 *     console.log("Code:", msg.payload.frag);
 *   }
 * }
 * ```
 */
export async function* parseAIStream(
  prompt: string | Message[],
  options: CallAIOptions,
): AsyncGenerator<StreamMessage, void, unknown> {
  const streamId = nextStreamId();
  const model = options.model || "unknown";

  // Emit stream start
  yield createMessage(StreamTypes.STREAM_START, model, "client", {
    streamId,
    model,
    timestamp: Date.now(),
  });

  try {
    // Use callAIStreamingSemantic to get StreamMessage events directly
    for await (const event of callAIStreamingSemantic(prompt, options)) {
      yield event;
    }

    // Emit stream end
    yield createMessage(StreamTypes.STREAM_END, model, "client", {
      streamId,
      finishReason: "stop",
      timestamp: Date.now(),
    });
  } catch (error) {
    // Emit error message
    yield createMessage(StreamTypes.STREAM_ERROR, model, "client", {
      streamId,
      message: error instanceof Error ? error.message : String(error),
      recoverable: false,
      timestamp: Date.now(),
    });

    // Re-throw to propagate to caller
    throw error;
  }
}

/**
 * Collect all stream messages into an array
 * Useful for testing or when you need the complete sequence
 */
export async function collectStreamMessages(prompt: string | Message[], options: CallAIOptions): Promise<StreamMessage[]> {
  const messages: StreamMessage[] = [];
  for await (const msg of parseAIStream(prompt, options)) {
    messages.push(msg);
  }
  return messages;
}
