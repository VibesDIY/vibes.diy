import { OnFunc } from "@adviser/cement";

import { OpenRouterParser } from "./parser/openrouter-parser.js";
import { createCodeBlockHandler } from "./parser/handlers/code-block-handler.js";
import { ParserEvent } from "./parser/parser-evento.js";
import { Segment } from "./parser/segment-accumulator.js";
import { VibesEvent } from "./vibes-events.js";
import { CallAIOptions, Message, CallAIError } from "./types.js";
import { keyStore, globalDebug } from "./key-management.js";
import { callAiFetch, joinUrlParts } from "./utils.js";
import { callAiEnv } from "./env.js";

export interface VibesStreamOptions extends CallAIOptions {
  prompt: string | Message[];
}

// Re-export Segment for consumers
export { Segment };

/**
 * VibesStream - Event-based streaming for vibes.diy code generation
 *
 * Emits structured events as content streams in:
 * - vibes.begin: Stream started
 * - vibes.update: Content update with { text, segments }
 * - vibes.end: Stream complete with final content and stats
 * - vibes.error: Error occurred
 *
 * Usage:
 * ```typescript
 * const stream = new VibesStream();
 * stream.onEvent((evt) => {
 *   switch (evt.type) {
 *     case "vibes.begin": console.log("Started:", evt.streamId); break;
 *     case "vibes.update": render(evt.segments); break;
 *     case "vibes.end": save(evt.text); break;
 *     case "vibes.error": handleError(evt.message); break;
 *   }
 * });
 *
 * // Feed chunks from network
 * for await (const chunk of response.body) {
 *   stream.processChunk(chunk);
 * }
 * stream.finalize();
 * ```
 */
export class VibesStream {
  readonly onEvent = OnFunc<(event: VibesEvent) => void>();

  private readonly parser: OpenRouterParser;
  private readonly streamId: string;
  private started = false;
  private model: string | undefined;

  // Segment accumulation (inlined from SegmentAccumulator)
  private readonly _segments: Segment[] = [];
  private currentMarkdown: Segment | null = null;
  private currentCode: Segment | null = null;

  // Stats captured from or.usage event
  private stats: {
    promptTokens: number | undefined;
    completionTokens: number | undefined;
    totalTokens: number | undefined;
  } = {
    promptTokens: undefined,
    completionTokens: undefined,
    totalTokens: undefined,
  };

  constructor(options?: { model?: string }) {
    this.streamId = crypto.randomUUID();
    this.model = options?.model;

    // Create parser and register code block handler
    this.parser = new OpenRouterParser();
    this.parser.register(createCodeBlockHandler());

    // Wire up event handlers
    this.parser.onEvent((evt: ParserEvent) => {
      this.handleParserEvent(evt);
    });
  }

  /**
   * Process a chunk of SSE data
   */
  processChunk(chunk: string): void {
    if (!this.started) {
      this.started = true;
      this.onEvent.invoke({
        type: "vibes.begin",
        streamId: this.streamId,
        model: this.model,
      });
    }

    this.parser.processChunk(chunk);
  }

  /**
   * Finalize the stream - call when all chunks have been processed
   */
  finalize(): void {
    if (!this.started) {
      this.started = true;
      this.onEvent.invoke({
        type: "vibes.begin",
        streamId: this.streamId,
        model: this.model,
      });
    }

    // Signal stream end to flush any buffered content
    this.parser.finalize();

    // Rebuild text from segments
    const text = this.buildText();

    this.onEvent.invoke({
      type: "vibes.end",
      streamId: this.streamId,
      text,
      segments: [...this._segments],
      stats: this.stats,
    });
  }

  /**
   * Get current segments (read-only)
   */
  get segments(): readonly Segment[] {
    return this._segments;
  }

  /**
   * Process a complete request - fetches from API and streams response
   *
   * @example
   * ```typescript
   * const stream = new VibesStream();
   * stream.onEvent((evt) => {
   *   switch (evt.type) {
   *     case "vibes.update": render(evt.segments); break;
   *     case "vibes.end": save(evt.text); break;
   *     case "vibes.error": handleError(evt.message); break;
   *   }
   * });
   * await stream.process({ prompt: messages, model: "openai/gpt-4o", apiKey });
   * ```
   */
  async process(options: VibesStreamOptions): Promise<void> {
    const debug = options.debug || globalDebug;

    // Get API key
    const apiKey = options.apiKey || keyStore().current || callAiEnv.CALLAI_API_KEY;
    if (!apiKey) {
      this.onEvent.invoke({
        type: "vibes.error",
        message: "API key is required",
        status: 401,
      });
      throw new CallAIError({
        message: "API key is required",
        status: 401,
        errorType: "authentication_error",
      });
    }

    // Update model for begin event
    this.model = options.model;

    // Build endpoint URL
    const customChatOrigin = options.chatUrl || callAiEnv.def.CALLAI_CHAT_URL || null;
    const endpoint =
      options.endpoint ||
      (customChatOrigin
        ? joinUrlParts(customChatOrigin, "/api/v1/chat/completions")
        : "https://openrouter.ai/api/v1/chat/completions");

    // Build messages array
    const messages: Message[] = Array.isArray(options.prompt)
      ? options.prompt
      : [{ role: "user", content: options.prompt }];

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
      console.log(`[VibesStream] Fetching: ${endpoint}`);
      console.log(`[VibesStream] Model: ${requestParams.model}`);
    }

    try {
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

        this.onEvent.invoke({
          type: "vibes.error",
          message: errorMessage,
          status: response.status,
        });

        throw new CallAIError({
          message: errorMessage,
          status: response.status,
          statusText: response.statusText,
        });
      }

      const reader = response.body?.getReader();

      if (!reader) {
        this.onEvent.invoke({
          type: "vibes.error",
          message: "No response body",
          status: 500,
        });
        throw new CallAIError({
          message: "No response body",
          status: 500,
        });
      }

      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            // Flush decoder and finalize
            const finalChunk = decoder.decode(undefined, { stream: false });
            if (finalChunk) {
              this.processChunk(finalChunk);
            }
            this.finalize();
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          this.processChunk(chunk);
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      // If we haven't emitted an error event yet, emit one now
      if (error instanceof CallAIError) {
        throw error; // Already handled
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.onEvent.invoke({
        type: "vibes.error",
        message: errorMessage,
        status: undefined,
      });
      throw error;
    }
  }

  private handleParserEvent(evt: ParserEvent): void {
    let segmentsChanged = false;

    switch (evt.type) {
      case "text.fragment":
        if (evt.fragment) {
          if (!this.currentMarkdown) {
            this.currentMarkdown = { type: "markdown", content: "" };
            this._segments.push(this.currentMarkdown);
          }
          this.currentMarkdown.content += evt.fragment;
          segmentsChanged = true;
        }
        break;

      case "code.start":
        this.currentMarkdown = null;
        this.currentCode = { type: "code", content: "" };
        this._segments.push(this.currentCode);
        segmentsChanged = true;
        break;

      case "code.fragment":
        if (evt.fragment && this.currentCode) {
          this.currentCode.content += evt.fragment;
          segmentsChanged = true;
        }
        break;

      case "code.end":
        this.currentCode = null;
        this.currentMarkdown = null;
        break;

      case "or.usage":
        this.stats = {
          promptTokens: evt.promptTokens,
          completionTokens: evt.completionTokens,
          totalTokens: evt.totalTokens,
        };
        break;
    }

    // Emit update when segments change
    if (segmentsChanged && this.started) {
      this.emitUpdate();
    }
  }

  private emitUpdate(): void {
    const text = this.buildText();
    this.onEvent.invoke({
      type: "vibes.update",
      text,
      segments: [...this._segments],
    });
  }

  private buildText(): string {
    return this._segments
      .map((s) => {
        if (s.type === "markdown") {
          return s.content;
        } else {
          return "```\n" + s.content + "\n```";
        }
      })
      .join("");
  }
}
