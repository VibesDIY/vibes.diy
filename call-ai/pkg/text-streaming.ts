/**
 * Text streaming - Uses OpenRouterParser for plain text responses
 */

import { CallAIError, CallAIOptions, ResponseMeta, SchemaStrategy } from "./types.js";
import { responseMetadata, boxString } from "./response-metadata.js";
import { LineStreamParser, LineStreamState } from "./parser/line-stream.js";
import { SSEDataParser } from "./parser/sse-data-parser.js";
import { JsonParser } from "./parser/json-parser.js";
import { OpenRouterParser } from "./parser/openrouter-parser.js";

function createTextParser(): OpenRouterParser {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  return new OpenRouterParser(jsonParser);
}

async function* parseTextSSE(
  response: Response,
  schemaStrategy: SchemaStrategy,
): AsyncGenerator<string, string, unknown> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is undefined - API endpoint may not support streaming");
  }

  const textDecoder = new TextDecoder();
  const orParser = createTextParser();

  let accumulated = "";
  let pendingChunks: string[] = [];
  let pendingError: Error | null = null;

  // Collect text deltas
  orParser.onDelta((evt) => {
    if (evt.content) {
      pendingChunks.push(evt.content);
    }
  });

  // Handle errors in stream - store for throwing in generator
  orParser.onJson((evt) => {
    const json = evt.json as Record<string, unknown>;
    if (json.error || json.type === "error") {
      const errorMessage =
        (json.error as { message?: string })?.message || "Unknown streaming error";
      pendingError = new CallAIError({
        message: `API streaming error: ${errorMessage}`,
        status: (json.error as { status?: number })?.status || 400,
        statusText: (json.error as { type?: string })?.type || "Bad Request",
        details: JSON.stringify(json.error || json),
        contentType: "application/json",
      });
    }
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = textDecoder.decode(value, { stream: true });
      orParser.processChunk(chunk);

      // Check for errors after processing
      if (pendingError) {
        throw pendingError;
      }

      // Yield accumulated text after each network chunk
      for (const text of pendingChunks) {
        accumulated += text;
        yield schemaStrategy.processResponse(accumulated);
      }
      pendingChunks = [];
    }

    return accumulated;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create a streaming generator for text responses using the parser stack.
 *
 * This replaces createStreamingGenerator for non-schema text responses,
 * using OpenRouterParser instead of manual parseSSE buffer management.
 */
export async function* createTextStreamingGenerator(
  response: Response,
  options: CallAIOptions,
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<string, string, unknown> {
  const meta: ResponseMeta = {
    model,
    endpoint: options.endpoint || "https://openrouter.ai/api/v1",
    timing: {
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
    },
  };

  let finalResult = "";
  for await (const chunk of parseTextSSE(response, schemaStrategy)) {
    finalResult = chunk;
    yield chunk;
  }

  const endTime = Date.now();
  meta.timing.endTime = endTime;
  meta.timing.duration = endTime - meta.timing.startTime;
  meta.rawResponse = finalResult;

  const boxed = boxString(finalResult);
  responseMetadata.set(boxed, meta);

  return finalResult;
}
