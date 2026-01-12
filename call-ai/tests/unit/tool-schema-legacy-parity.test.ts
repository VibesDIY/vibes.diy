import { describe, it, expect, vi, beforeEach } from "vitest";
import { callAIStreaming } from "../../pkg/streaming.js";
import { chooseSchemaStrategy } from "../../pkg/strategies/strategy-selector.js";

// Helper to create SSE encoded chunks
function toSSE(data: any): string {
  return `data: ${JSON.stringify(data)}

`;
}

// Helper to create a mock Response with a ReadableStream
function createSSEResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
        // Add a small delay to simulate network
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" }
  });
}

describe("Legacy Tool Call Parity", () => {
  const apiKey = "test-api-key";
  
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("should assemble tool call from multiple chunks", async () => {
    const chunks = [
      toSSE({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              id: "call_123",
              function: { name: "test_func", arguments: '{"foo":' }
            }]
          }
        }]
      }),
      toSSE({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: { arguments: '"bar"}' }
            }]
          }
        }]
      }),
      toSSE({
        choices: [{
          finish_reason: "tool_calls"
        }]
      }),
      "data: [DONE]\n\n"
    ];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const schema = { properties: { foo: { type: "string" } } };
    const model = "anthropic/claude-3-sonnet"; // Triggers tool_mode
    const strategy = chooseSchemaStrategy(model, schema);
    
    const generator = callAIStreaming("Hi", { apiKey, model, schemaStrategy: strategy, schema });
    
    const results = [];
    for await (const chunk of generator) {
      console.log("Got chunk:", chunk);
      results.push(chunk);
    }

    // The legacy implementation yields the assembled JSON string once on finish_reason
    // It should handle the split JSON correctly
    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0])).toEqual({ foo: "bar" });
  });

  it("should handle tool call arguments split mid-token", async () => {
    // This tests the JSON repair/accumulation logic
    const chunks = [
      toSSE({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: { arguments: '{"message": "Hello ' }
            }]
          }
        }]
      }),
      toSSE({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: { arguments: 'World"}' }
            }]
          }
        }]
      }),
      toSSE({
        choices: [{
          finish_reason: "tool_calls"
        }]
      }),
      "data: [DONE]\n\n"
    ];

    vi.mocked(fetch).mockResolvedValue(createSSEResponse(chunks));

    const schema = { properties: { message: { type: "string" } } };
    const model = "anthropic/claude-3-sonnet";
    const strategy = chooseSchemaStrategy(model, schema);
    
    const generator = callAIStreaming("Hi", { apiKey, model, schemaStrategy: strategy, schema });
    
    const results = [];
    for await (const chunk of generator) {
      results.push(chunk);
    }

    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0])).toEqual({ message: "Hello World" });
  });
});
