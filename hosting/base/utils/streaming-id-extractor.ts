/**
 * Streaming ID and Usage Extractor
 *
 * Extracts generation IDs and usage data from OpenRouter streaming responses.
 * Uses a TransformStream to pass through all data unchanged while
 * extracting the generation ID and usage metrics from the stream.
 *
 * OpenRouter sends usage data (cost, tokens) in the final chunk with the
 * "usage" field. This allows us to capture costs without a separate API call.
 */

/**
 * Usage data extracted from streaming response
 */
export interface StreamingUsageData {
  id: string;
  model: string;
  /** Unix timestamp (seconds) when generation was created */
  createdAt: number;
  cost: number;
  tokensPrompt: number;
  tokensCompletion: number;
  /** True if usage was extracted from stream, false if only ID was found */
  hasUsageData: boolean;
}

/**
 * Creates a TransformStream that extracts generation ID and usage data from SSE chunks
 * while passing all data through unchanged.
 *
 * @param onUsageExtracted - Callback invoked when usage data is found (or stream ends with just ID)
 * @returns TransformStream that can be piped through the response body
 */
export function createUsageExtractorStream(
  onUsageExtracted: (data: StreamingUsageData) => void,
): TransformStream<Uint8Array, Uint8Array> {
  let callbackCalled = false;
  let extractedId: string | null = null;
  let extractedModel: string | null = null;
  let extractedCreatedAt: number | null = null;
  let buffer = "";

  return new TransformStream({
    transform(chunk, controller) {
      // Always pass through the chunk unchanged
      controller.enqueue(chunk);

      // Only process if we haven't called back yet
      if (callbackCalled) {
        return;
      }

      // Handle empty chunks
      if (chunk.length === 0) {
        return;
      }

      // Decode and add to buffer (handles split chunks)
      const text = new TextDecoder().decode(chunk);
      buffer += text;

      // Process complete SSE lines in buffer
      const lines = buffer.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;

        try {
          const data = JSON.parse(jsonStr);

          // Track ID if present (usually in first chunk)
          if (data.id && !extractedId) {
            extractedId = data.id;
          }

          // Track model if present
          if (data.model && !extractedModel) {
            extractedModel = data.model;
          }

          // Track created timestamp if present
          if (data.created && !extractedCreatedAt) {
            extractedCreatedAt = data.created;
          }

          // Check for usage data (in final chunk)
          // OpenRouter includes cost directly in usage object
          if (data.usage && typeof data.usage.cost === "number") {
            callbackCalled = true;
            onUsageExtracted({
              id: data.id || extractedId || "unknown",
              model: data.model || extractedModel || "unknown",
              createdAt:
                data.created || extractedCreatedAt || Math.floor(Date.now() / 1000),
              cost: data.usage.cost,
              tokensPrompt: data.usage.prompt_tokens ?? 0,
              tokensCompletion: data.usage.completion_tokens ?? 0,
              hasUsageData: true,
            });
            buffer = "";
            return;
          }
        } catch {
          // Ignore parse errors, might be partial JSON
        }
      }

      // Prevent buffer from growing too large
      if (buffer.length > 10000) {
        const lastNewlines = buffer.lastIndexOf("\n\n");
        if (lastNewlines !== -1) {
          buffer = buffer.slice(lastNewlines + 2);
        }
      }
    },

    flush() {
      // Stream ended - call back with whatever we have
      if (!callbackCalled && extractedId) {
        onUsageExtracted({
          id: extractedId,
          model: extractedModel || "unknown",
          createdAt: extractedCreatedAt || Math.floor(Date.now() / 1000),
          cost: 0,
          tokensPrompt: 0,
          tokensCompletion: 0,
          hasUsageData: false, // Will need to fetch from API
        });
      }
      buffer = "";
    },
  });
}

/**
 * @deprecated Use createUsageExtractorStream instead for full usage extraction
 *
 * Creates a TransformStream that extracts the generation ID from SSE chunks
 * while passing all data through unchanged.
 *
 * @param onIdFound - Callback invoked when a generation ID is found (called once)
 * @returns TransformStream that can be piped through the response body
 */
export function createIdExtractorStream(
  onIdFound: (id: string) => void,
): TransformStream<Uint8Array, Uint8Array> {
  // Wrap the new implementation for backwards compatibility
  return createUsageExtractorStream((data) => {
    onIdFound(data.id);
  });
}
