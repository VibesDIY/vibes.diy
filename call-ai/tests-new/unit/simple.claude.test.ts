import { vitest, describe, it, expect, beforeEach, assert } from "vitest";
import { callAi } from "call-ai";
import { HttpHeader } from "@adviser/cement";

// Mock global fetch
const mock = { fetch: vitest.fn() };

describe("Claude JSON Property Splitting Test", () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it("should handle property name splitting across chunks", async () => {
    // This test specifically targets Claude's JSON property splitting issue
    const options = {
      apiKey: "test-api-key",
      model: "anthropic/claude-3-sonnet",
      stream: true,
      debug: true, // Enable debug mode to see what's happening
      schema: {
        type: "object",
        properties: {
          capital: { type: "string" },
          population: { type: "number" },
          languages: { type: "array", items: { type: "string" } },
        },
      },
      mock,
    };

    // Create a simple mock that focuses on the specific property splitting issue
    const mockResponse: Response = {
      clone: () => mockResponse,
      ok: true,
      status: 200,
      headers: HttpHeader.from({ "content-type": "application/json" }).AsHeaders(),
      // forEach: vitest.fn(),
      // },
      text: async function (this: Response) {
        let result = "";
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const reader = this.body!.getReader();
        while (true) {
          const x = await reader.read();
          const { done, value } = x;
          if (done) break;
          result += new TextDecoder().decode(value);
        }
        return result;
      },
      body: {
        getReader: () => ({
          read: vitest
            .fn()
            // Streaming setup chunk
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`data: {"type":"message_start"}\n\n`),
            })
            // First part with split property "popul"
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                // eslint-disable-next-line no-useless-escape
                `data: {"type":"content_block_delta","delta":{"text":"{\\\"capital\\\":\\\"Paris\\\", \\\"popul"}}\n\n`,
              ),
            })
            // Second part with "ation" completing the property name
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                // eslint-disable-next-line no-useless-escape
                `data: {"type":"content_block_delta","delta":{"text":"ation\\\":67.5, \\\"languages\\\":[\\\"French\\\"]}"}}\n\n`,
              ),
            })
            // Final chunk with tool_calls completion signal
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`data: {"type":"message_delta","delta":{"stop_reason":"tool_calls"}}\n\n`),
            })
            // End of stream
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      } as unknown as ReadableStream<Uint8Array>,
    } as unknown as Response;

    // Override mock.fetch mock for this test
    mock.fetch.mockResolvedValueOnce(mockResponse);

    const generator = await callAi("Provide information about France.", options); // as AsyncGenerator<string, string, unknown>;

    if (typeof generator === "string") {
      assert("Expected generator, got string");
      return;
    }

    // The expected final parsed result
    const expectedResult = {
      capital: "Paris",
      population: 67.5,
      languages: ["French"],
    };

    // Collect results from streaming
    let finalResult = "";
    let chunkCount = 0;

    for await (const chunk of generator) {
      finalResult = chunk;
    }

    // The key test - our implementation should produce valid JSON
    // despite the property name "population" being split across chunks
    const parsedResult = JSON.parse(finalResult);

    // Validate the parsed result matches our expectations
    expect(parsedResult).toEqual(expectedResult);

    // We should receive a single chunk with the complete JSON
    expect(chunkCount).toBe(1);
  });
});
