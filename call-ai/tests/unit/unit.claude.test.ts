/* eslint-disable no-useless-escape */
import { callAi } from "call-ai";
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock global fetch
const global = globalThis;
const globalFetch = vi.fn<typeof fetch>();
global.fetch = globalFetch;

// Simple mock for TextDecoder
// global.TextDecoder = vi.fn().mockImplementation(() => ({
//   decode: vi.fn((value: Uint8Array) => {
//     // Basic mock implementation without recursion
//     if (value instanceof Uint8Array) {
//       // Convert the Uint8Array to a simple string
//       return Array.from(value)
//         .map((byte) => String.fromCharCode(byte))
//         .join("");
//     }
//     return "";
//   }),
// })) as typeof global.TextDecoder;

describe("Claude Streaming JSON Property Splitting Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.skip("should handle Claude property splitting in streaming responses", async () => {
    // This test simulates Claude's behavior where property names and values
    // can be split across multiple chunks
    const options = {
      apiKey: "test-api-key",
      model: "anthropic/claude-3-sonnet", // Claude model
      stream: true,
      schema: {
        type: "object",
        properties: {
          capital: { type: "string" },
          population: { type: "number" },
          languages: { type: "array", items: { type: "string" } },
        },
      },
    };

    // Create a simpler mock that just simulates a single property name split
    const mockResponse = {
      ok: true,
      status: 200,
      body: {
        getReader: vi.fn().mockReturnValue({
          read: vi
            .fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
            // First chunk: starts with {"capital"
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":"{\\\"capital\\\""}}\n\n`
              ),
            })
            // Second chunk: continues with : "Paris", then partial "popul"
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":":\\\"Paris\\\", \\\"popul"}}\n\n`
              ),
            })
            // Third chunk: finishes "ation": 67.5
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":"ation\\\":67.5"}}\n\n`
              ),
            })
            // Fourth chunk: starts with "lang"
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":", \\\"lang"}}\n\n`
              ),
            })
            // Fifth chunk: finishes "uages":["French"]}
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":"uages\\\":[\\\"French\\\"]}"}}\n\n`
              ),
            })
            // Final chunk with finish reason "tool_calls"
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`data: {"id":"123","type":"content_block_stop","stop_reason":"tool_calls"}\n\n`),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    } as unknown as Response;

    // Override the global.fetch mock for this test
    globalFetch.mockResolvedValueOnce(mockResponse);

    const generator = (await callAi("Provide information about France.", options)) as AsyncGenerator<string, string, unknown>;

    // Collect all chunks to simulate what would happen in the actual application
    const chunks: string[] = [];
    let lastValue = "";
    for await (const chunk of generator) {
      chunks.push(chunk);
      lastValue = chunk;
    }

    // Test that the final result is valid JSON despite the property name splits
    expect(() => JSON.parse(lastValue)).not.toThrow();

    // Verify the parsed content contains all expected values
    const parsedResult = JSON.parse(lastValue);
    expect(parsedResult.capital).toBe("Paris");
    expect(parsedResult.population).toBe(67.5);
    expect(parsedResult.languages).toEqual(["French"]);

    // We should have gotten 1 chunk (the final complete JSON)
    expect(chunks.length).toBe(1);
  });

  // Add more tests when the first one passes
  it.skip("should handle Claude property value splitting", async () => {
    // This test simulates Claude's behavior where property values
    // can be split in the middle
    const options = {
      apiKey: "test-api-key",
      model: "anthropic/claude-3-sonnet", // Claude model
      stream: true,
      schema: {
        type: "object",
        properties: {
          capital: { type: "string" },
          population: { type: "number" },
          languages: { type: "array", items: { type: "string" } },
        },
      },
    };

    // Set up the mock to simulate Claude's streaming behavior
    // with property values split across chunks
    const mockResponseWithSplitValues = {
      ok: true,
      status: 200,
      body: {
        getReader: vi.fn().mockReturnValue({
          read: vi
            .fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
            // First chunk: starts with {"capital": "Par
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":"{\\\"capital\\\": \\\"Par"}}\n\n`
              ),
            })
            // Second chunk: continues with "is", "population": 67
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":"is\\\", \\\"population\\\": 67"}}\n\n`
              ),
            })
            // Third chunk: completes with .5 and languages
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":".5, \\\"languages\\\": [\\\"Fren"}}\n\n`
              ),
            })
            // Fourth chunk: completes with "ch"]}
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":"ch\\\"]}"}}\n\n`
              ),
            })
            // Final chunk with finish reason "tool_calls"
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`data: {"id":"123","type":"content_block_stop","stop_reason":"tool_calls"}\n\n`),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    } as unknown as Response;

    // Override the global.fetch mock for this test
    globalFetch.mockResolvedValueOnce(mockResponseWithSplitValues);

    const generator = (await callAi("Provide information about France.", options)) as AsyncGenerator<string, string, unknown>;

    // Collect all chunks to simulate what would happen in the actual application
    const chunks: string[] = [];
    let lastValue = "";
    for await (const chunk of generator) {
      chunks.push(chunk);
      lastValue = chunk;
    }

    // Test that the final result is valid JSON despite the property value splits
    expect(() => JSON.parse(lastValue)).not.toThrow();

    // Verify the parsed content contains all expected values
    const parsedResult = JSON.parse(lastValue);
    expect(parsedResult.capital).toBe("Paris");
    expect(parsedResult.population).toBe(67.5);
    expect(parsedResult.languages).toEqual(["French"]);

    // We should have gotten one final chunk as per our implementation
    expect(chunks.length).toBe(1);
  });

  // Additional test case for future implementation
  it.skip("should handle missing values", async () => {
    // This test simulates Claude's error case where a property value is completely missing
    const options = {
      apiKey: "test-api-key",
      model: "anthropic/claude-3-sonnet", // Claude model
      stream: true,
      schema: {
        type: "object",
        properties: {
          capital: { type: "string" },
          population: { type: "number" },
          languages: { type: "array", items: { type: "string" } },
        },
      },
    };

    // Set up the mock to simulate Claude's error case
    const mockResponseWithMissingValue = {
      ok: true,
      status: 200,
      body: {
        getReader: vi.fn().mockReturnValue({
          read: vi
            .fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
            // First chunk: starts with {"capital":
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":"{\\\"capital\\\": "}}\n\n`
              ),
            })
            // Second chunk: continues with , "population": 67.5
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":", \\\"population\\\": 67.5"}}\n\n`
              ),
            })
            // Third chunk: completes with languages
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(
                `data: {"id":"123","type":"content_block_delta","delta":{"type":"text_delta","text":", \\\"languages\\\": [\\\"French\\\"]}"}}\n\n`
              ),
            })
            // Final chunk with finish reason "tool_calls"
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode(`data: {"id":"123","type":"content_block_stop","stop_reason":"tool_calls"}\n\n`),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    } as unknown as Response;

    // Override the global.fetch mock for this test
    globalFetch.mockResolvedValueOnce(mockResponseWithMissingValue);

    const generator = (await callAi("Provide information about France.", options)) as AsyncGenerator<string, string, unknown>;

    // Collect all chunks to simulate what would happen in the actual application
    const chunks: string[] = [];
    let lastValue = "";
    for await (const chunk of generator) {
      chunks.push(chunk);
      lastValue = chunk;
    }

    // Test that the final result is valid JSON despite the missing property value
    expect(() => JSON.parse(lastValue)).not.toThrow();

    // Verify the parsed content contains all expected values except capital
    const parsedResult = JSON.parse(lastValue);
    expect(parsedResult.population).toBe(67.5);
    expect(parsedResult.languages).toEqual(["French"]);

    // We should have gotten one final chunk as per our implementation
    expect(chunks.length).toBe(1);
  });
});
