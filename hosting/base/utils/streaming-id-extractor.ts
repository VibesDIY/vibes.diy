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
  const decoder = new TextDecoder();
  let callbackCalled = false;
  let extractedId: string | null = null;
  let extractedModel: string | null = null;
  let extractedCreatedAt: number | null = null;
  let buffer = "";

  function safelyCallOnUsageExtracted(data: StreamingUsageData) {
    try {
      onUsageExtracted(data);
    } catch (error) {
      console.error("Usage extractor callback failed:", error);
    }
  }

  function processSseLine(line: string): boolean {
    const trimmed = line.trimEnd();
    if (!trimmed.startsWith("data:")) return false;

    let payload = trimmed.slice("data:".length);
    if (payload.startsWith(" ")) payload = payload.slice(1);
    const jsonStr = payload.trim();
    if (jsonStr === "[DONE]") return false;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr) as unknown;
    } catch {
      return false;
    }

    if (!parsed || typeof parsed !== "object") return false;
    const data = parsed as Record<string, unknown>;

    const id = typeof data.id === "string" ? data.id : undefined;
    const model = typeof data.model === "string" ? data.model : undefined;
    const created = typeof data.created === "number" ? data.created : undefined;

    // Track ID/model/created if present (typically in early chunks)
    if (id && !extractedId) extractedId = id;
    if (model && !extractedModel) extractedModel = model;
    if (created && !extractedCreatedAt) extractedCreatedAt = created;

    const usageValue = data.usage;
    if (!usageValue || typeof usageValue !== "object") return false;
    const usage = usageValue as Record<string, unknown>;
    const cost = usage.cost;
    if (typeof cost !== "number") return false;

    callbackCalled = true;
    safelyCallOnUsageExtracted({
      id: id ?? extractedId ?? "unknown",
      model: model ?? extractedModel ?? "unknown",
      createdAt: created ?? extractedCreatedAt ?? Math.floor(Date.now() / 1000),
      cost,
      tokensPrompt:
        typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : 0,
      tokensCompletion:
        typeof usage.completion_tokens === "number"
          ? usage.completion_tokens
          : 0,
      hasUsageData: true,
    });
    return true;
  }

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
      buffer += decoder.decode(chunk, { stream: true });

      const lastNewlineIndex = buffer.lastIndexOf("\n");
      if (lastNewlineIndex === -1) {
        // No complete lines yet. Keep buffer bounded.
        if (buffer.length > 10000) buffer = buffer.slice(-10000);
        return;
      }

      const completeLines = buffer.slice(0, lastNewlineIndex);
      buffer = buffer.slice(lastNewlineIndex + 1);

      for (const line of completeLines.split("\n")) {
        if (processSseLine(line)) {
          buffer = "";
          return;
        }
      }

      // Keep remainder bounded in case a single line is extremely large.
      if (buffer.length > 10000) buffer = buffer.slice(-10000);
    },

    flush() {
      if (callbackCalled) {
        buffer = "";
        return;
      }

      buffer += decoder.decode();

      // Process any remaining lines (even if the stream didn't end in a newline)
      for (const line of buffer.split("\n")) {
        if (processSseLine(line)) {
          buffer = "";
          return;
        }
      }

      // Stream ended - call back with whatever we have
      if (!callbackCalled && extractedId) {
        safelyCallOnUsageExtracted({
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
