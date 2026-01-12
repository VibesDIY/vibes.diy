import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAIStreaming } from "../../pkg/streaming.js";
import { chooseSchemaStrategy } from "../../pkg/strategies/strategy-selector.js";
import { CallAIError } from "../../pkg/types.js";

// Helper to create SSE encoded chunks
function toSSE(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Helper to create a mock Response with a ReadableStream
function createSSEResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
        // Add a small delay to simulate network
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("callAIStreaming complex scenarios", () => {
  const apiKey = "test-api-key";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should handle basic text streaming", async () => {
    const chunks = [
      toSSE({ choices: [{ delta: { content: "Hello" } }] }),
      toSSE({ choices: [{ delta: { content: " world" } }] }),
      "data: [DONE]\n\n",
    ];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const strategy = chooseSchemaStrategy("openai/gpt-4o", null);
    const generator = callAIStreaming("Hi", { apiKey, schemaStrategy: strategy });

    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(["Hello", "Hello world"]);
  });

  it("should handle Claude tool_use streaming with chunked arguments", async () => {
    const chunks = [
      toSSE({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { name: "test", arguments: '{"foo":' },
                },
              ],
            },
          },
        ],
      }),
      toSSE({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  function: { arguments: '"bar"}' },
                },
              ],
            },
          },
        ],
      }),
      toSSE({
        choices: [
          {
            finish_reason: "tool_calls",
          },
        ],
      }),
      "data: [DONE]\n\n",
    ];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const schema = { properties: { foo: { type: "string" } } };
    const model = "anthropic/claude-3-sonnet";
    const strategy = chooseSchemaStrategy(model, schema);
    const generator = callAIStreaming("Hi", { apiKey, model, schemaStrategy: strategy, schema, debug: true });

    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    // The current implementation yields after tool_calls finish_reason or at the end
    expect(results).toContain('{"foo":"bar"}');
  });

  it("should handle API error in the stream", async () => {
    const chunks = [toSSE({ error: { message: "Rate limit exceeded", status: 429 } })];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const strategy = chooseSchemaStrategy("openai/gpt-4o", null);
    const generator = callAIStreaming("Hi", { apiKey, schemaStrategy: strategy });

    await expect(async () => {
      for await (const _ of generator) {
      }
    }).rejects.toThrow(/Rate limit exceeded/);
  });

  it("should handle Claude old format tool_use (type: tool_use)", async () => {
    const chunks = [
      toSSE({
        type: "tool_use",
        input: { result: "success" },
      }),
      "data: [DONE]\n\n",
    ];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const schema = { properties: { result: { type: "string" } } };
    const model = "anthropic/claude-3-sonnet";
    const strategy = chooseSchemaStrategy(model, schema);
    const generator = callAIStreaming("Hi", { apiKey, model, schemaStrategy: strategy, schema });

    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toContain('{"result":"success"}');
  });

  it("should handle content_block_delta format (Claude format)", async () => {
    const chunks = [
      toSSE({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Streaming" },
      }),
      toSSE({
        type: "content_block_delta",
        delta: { type: "text_delta", text: " content" },
      }),
      "data: [DONE]\n\n",
    ];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const strategy = chooseSchemaStrategy("anthropic/claude-3-sonnet", null);
    const generator = callAIStreaming("Hi", { apiKey, schemaStrategy: strategy });

    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toEqual(["Streaming", "Streaming content"]);
  });

  it("should throw error if response body is undefined", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null));

    const strategy = chooseSchemaStrategy("openai/gpt-4o", null);
    const generator = callAIStreaming("Hi", { apiKey, schemaStrategy: strategy });

    await expect(async () => {
      for await (const _ of generator) {
      }
    }).rejects.toThrow("Response body is undefined");
  });

  it("should handle malformed JSON in tool_calls and attempt to fix it", async () => {
    // This tests the robust fix logic in parseSSE
    const chunks = [
      toSSE({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  function: { arguments: '{"truncated": "json' }, // Missing closing quote and brace
                },
              ],
            },
          },
        ],
      }),
      toSSE({
        choices: [
          {
            finish_reason: "tool_calls",
          },
        ],
      }),
    ];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const schema = { properties: { truncated: { type: "string" } } };
    const model = "anthropic/claude-3-sonnet";
    const strategy = chooseSchemaStrategy(model, schema);
    const generator = callAIStreaming("Hi", { apiKey, model, schemaStrategy: strategy, schema });

    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    // The fix logic should have added missing braces/quotes if possible,
    // or at least yielded the best-effort string.
    // Based on streaming.ts: result = "{" + result.trim(); if (!result.trim().endsWith("}")) result += "}";
    expect(results.length).toBeGreaterThan(0);
    const lastResult = results[results.length - 1];
    expect(lastResult).toContain("truncated");
  });
});
