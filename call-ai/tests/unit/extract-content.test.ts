import { callAi, Schema } from "call-ai";
import { extractContent } from "../../pkg/non-streaming.js";
import { describe, expect, it, vi } from "vitest";
import { SchemaStrategy } from "../../pkg/types.js";

/**
 * extractContent() Tests
 *
 * Tests the actual behavior of extractContent() and the non-streaming callAi() path.
 *
 * IMPORTANT: These tests document the CURRENT behavior, not ideal behavior.
 * Some response formats have bugs (content[] handling) or are dead code paths
 * (tool_calls for json_schema models). When we swap to NonStreamingOpenRouterParser,
 * we'll fix these issues.
 */

// Mock schema strategy that passes content through unchanged
function createPassthroughStrategy(): SchemaStrategy {
  return {
    strategy: "none",
    model: "test-model",
    shouldForceStream: false,
    prepareRequest: () => ({}),
    processResponse: (content: unknown) => {
      if (typeof content === "string") return content;
      return JSON.stringify(content);
    },
  };
}

describe("extractContent() direct tests", () => {
  const strategy = createPassthroughStrategy();

  describe("message.content (string) - WORKS", () => {
    it("extracts simple string content", () => {
      const result = extractContent(
        { choices: [{ message: { content: "Hello from AI" } }] },
        strategy,
      );
      expect(result).toBe("Hello from AI");
    });

    it("extracts JSON string content", () => {
      const result = extractContent(
        { choices: [{ message: { content: '{"name":"test","value":42}' } }] },
        strategy,
      );
      expect(result).toBe('{"name":"test","value":42}');
    });
  });

  describe("message.tool_calls - passes to strategy", () => {
    it("extracts tool_calls and passes to strategy for processing", () => {
      const toolCalls = [
        {
          id: "call_123",
          type: "function",
          function: {
            name: "get_data",
            arguments: '{"city":"Paris","country":"France"}',
          },
        },
      ];

      const result = extractContent({ choices: [{ message: { tool_calls: toolCalls } }] }, strategy);

      // Strategy receives the tool_calls array and stringifies it
      const parsed = JSON.parse(result);
      expect(parsed[0].function.arguments).toBe('{"city":"Paris","country":"France"}');
    });
  });

  describe("message.function_call (legacy format) - passes to strategy", () => {
    it("extracts function_call and passes to strategy for processing", () => {
      const functionCall = {
        name: "get_weather",
        arguments: '{"temperature":72,"unit":"fahrenheit"}',
      };

      const result = extractContent({ choices: [{ message: { function_call: functionCall } }] }, strategy);

      const parsed = JSON.parse(result);
      expect(parsed.arguments).toBe('{"temperature":72,"unit":"fahrenheit"}');
    });
  });

  describe("content[] with text blocks - BUG: Array.isArray check is dead code", () => {
    // BUG: The Array.isArray(choice.message.content) check on line 260 is never reached
    // because choice.message.content (array) is truthy, so line 245 catches it first.
    // This means content[] arrays are passed through as-is instead of concatenated.
    it("DOCUMENTS BUG: arrays are stringified instead of text-extracted", () => {
      const result = extractContent(
        {
          choices: [
            {
              message: {
                content: [
                  { type: "text", text: "Hello " },
                  { type: "text", text: "World" },
                ],
              },
            },
          ],
        },
        strategy,
      );

      // Current behavior: array is stringified (BUG)
      // Expected behavior: "Hello World"
      expect(result).toBe('[{"type":"text","text":"Hello "},{"type":"text","text":"World"}]');
    });
  });

  describe("content[] with tool_use blocks - BUG: never reached", () => {
    // Same bug as above - the tool_use extraction code is never reached
    it("DOCUMENTS BUG: tool_use blocks are stringified instead of extracted", () => {
      const result = extractContent(
        {
          choices: [
            {
              message: {
                content: [
                  {
                    type: "tool_use",
                    id: "toolu_123",
                    name: "get_data",
                    input: { name: "Alice", age: 30 },
                  },
                ],
              },
            },
          ],
        },
        strategy,
      );

      // Current behavior: array is stringified (BUG)
      // Expected behavior: extract tool_use input
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].type).toBe("tool_use");
    });
  });

  describe("choice.text fallback - WORKS", () => {
    it("extracts from choice.text when message.content is absent", () => {
      const result = extractContent({ choices: [{ text: "Fallback text response" }] }, strategy);

      expect(result).toBe("Fallback text response");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for null result", () => {
      const result = extractContent(null as any, strategy);
      expect(result).toBe("");
    });

    it("throws for response without extractable content", () => {
      expect(() => extractContent({ choices: [{ message: {} }] }, strategy)).toThrow(
        "Failed to extract content",
      );
    });

    it("passes through raw string result unchanged", () => {
      // Line 293: when result is already a string, return it directly
      const result = extractContent("raw string response" as any, strategy);
      expect(result).toBe("raw string response");
    });
  });
});

describe("extractContent() integration via callAi()", () => {
  // Helper to create a mock fetch that returns JSON response
  function createJsonMockFetch(jsonResponse: object) {
    return vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(jsonResponse),
      ok: true,
      status: 200,
      statusText: "OK",
    } as unknown as Response);
  }

  describe("non-streaming text path (no schema) - WORKS", () => {
    it("extracts simple string content through callAi", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: "Hello from AI" } }],
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe("Hello from AI");
    });

    it("extracts JSON string content through callAi", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: '{"name":"test","value":42}' } }],
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe('{"name":"test","value":42}');
    });

    it("extracts from choice.text fallback through callAi", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ text: "Fallback text response" }],
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe("Fallback text response");
    });
  });

  describe("non-streaming schema path (GPT-4o uses json_schema mode)", () => {
    // GPT-4o with schema uses json_schema response_format, which returns
    // content as a JSON string in message.content - NOT tool_calls.
    // This is the actual production code path.

    it("extracts JSON content with schema (actual production path)", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [
          {
            message: {
              content: '{"city":"Paris","country":"France"}',
            },
          },
        ],
      });

      const schema: Schema = {
        name: "location",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
        },
      };

      const result = await callAi("Get location", {
        apiKey: "test-key",
        model: "openai/gpt-4o",
        schema,
        mock: { fetch: mockFetch },
      });

      const parsed = JSON.parse(result);
      expect(parsed.city).toBe("Paris");
      expect(parsed.country).toBe("France");
    });

    // NOTE: GPT-4o with schema does NOT receive tool_calls in production.
    // But if it did, the parser correctly extracts the arguments.
    it("extracts tool_calls arguments correctly", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [
          {
            message: {
              tool_calls: [
                {
                  id: "call_123",
                  type: "function",
                  function: {
                    name: "get_data",
                    arguments: '{"city":"Paris","country":"France"}',
                  },
                },
              ],
            },
          },
        ],
      });

      const schema: Schema = {
        name: "location",
        properties: {
          city: { type: "string" },
          country: { type: "string" },
        },
      };

      const result = await callAi("Get location", {
        apiKey: "test-key",
        model: "openai/gpt-4o",
        schema,
        mock: { fetch: mockFetch },
      });

      // Parser correctly extracts the arguments string
      const parsed = JSON.parse(result);
      expect(parsed.city).toBe("Paris");
      expect(parsed.country).toBe("France");
    });
  });

  describe("edge cases through callAi", () => {
    it("returns empty string for empty content", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: "" } }],
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe("");
    });

    it("returns empty string for null content", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: null } }],
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe("");
    });
  });
});
