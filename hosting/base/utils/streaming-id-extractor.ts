/**
 * Streaming ID Extractor
 *
 * Extracts generation IDs from OpenRouter streaming responses.
 * Uses a TransformStream to pass through all data unchanged while
 * extracting the generation ID from the first chunk that contains it.
 */

/**
 * Creates a TransformStream that extracts the generation ID from SSE chunks
 * while passing all data through unchanged.
 *
 * @param onIdFound - Callback invoked when a generation ID is found (called once)
 * @returns TransformStream that can be piped through the response body
 */
export function createIdExtractorStream(
  onIdFound: (id: string) => void,
): TransformStream<Uint8Array, Uint8Array> {
  let idExtracted = false;
  let buffer = "";

  return new TransformStream({
    transform(chunk, controller) {
      // Always pass through the chunk unchanged
      controller.enqueue(chunk);

      // Only try to extract ID if we haven't found one yet
      if (idExtracted) {
        return;
      }

      // Handle empty chunks
      if (chunk.length === 0) {
        return;
      }

      // Decode and add to buffer (handles split chunks)
      const text = new TextDecoder().decode(chunk);
      buffer += text;

      // Try to extract ID from accumulated buffer
      // OpenRouter format: "id":"gen-xxxxx" or "id": "gen-xxxxx"
      const match = buffer.match(/"id"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        onIdFound(match[1]);
        idExtracted = true;
        // Clear buffer since we found what we need
        buffer = "";
      }

      // Prevent buffer from growing too large
      // If we have a complete SSE message (ends with \n\n) and no ID, clear buffer
      // Keep only the last part that might contain a partial ID
      if (buffer.length > 10000) {
        const lastNewlines = buffer.lastIndexOf("\n\n");
        if (lastNewlines !== -1) {
          buffer = buffer.slice(lastNewlines + 2);
        }
      }
    },

    flush() {
      // Clear buffer on stream end
      buffer = "";
    },
  });
}
