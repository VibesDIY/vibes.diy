import { callAi, Schema } from "call-ai";
import { NonStreamingOpenRouterParser } from "../../pkg/parser/non-streaming-openrouter-parser.js";
import { describe, expect, it, vi } from "vitest";

/**
 * NonStreamingOpenRouterParser Tests
 *
 * Tests the parser that handles non-streaming OpenRouter JSON responses.
 * The parser emits or.delta events with extracted content.
 */

// Helper to parse and extract content from or.delta event
function parseAndExtract(response: unknown): string {
  const parser = new NonStreamingOpenRouterParser();
  let content = "";
  parser.onEvent((evt) => {
    if (evt.type === "or.delta") {
      content = evt.content;
    }
  });
  parser.parse(response);
  return content;
}

describe("NonStreamingOpenRouterParser direct tests", () => {
  describe("message.content (string)", () => {
    it("extracts simple string content", () => {
      const result = parseAndExtract(
        { choices: [{ message: { content: "Hello from AI" } }] },
      );
      expect(result).toBe("Hello from AI");
    });

    it("extracts JSON string content", () => {
      const result = parseAndExtract(
        { choices: [{ message: { content: '{"name":"test","value":42}' } }] },
      );
      expect(result).toBe('{"name":"test","value":42}');
    });
  });

  describe("message.tool_calls", () => {
    it("extracts tool_calls arguments directly", () => {
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

      const result = parseAndExtract({ choices: [{ message: { tool_calls: toolCalls } }] });

      // Parser extracts the arguments string directly
      const parsed = JSON.parse(result);
      expect(parsed.city).toBe("Paris");
      expect(parsed.country).toBe("France");
    });
  });

  describe("message.function_call (legacy format)", () => {
    it("extracts function_call arguments directly", () => {
      const functionCall = {
        name: "get_weather",
        arguments: '{"temperature":72,"unit":"fahrenheit"}',
      };

      const result = parseAndExtract({ choices: [{ message: { function_call: functionCall } }] });

      const parsed = JSON.parse(result);
      expect(parsed.temperature).toBe(72);
      expect(parsed.unit).toBe("fahrenheit");
    });
  });

  describe("content[] with text blocks", () => {
    it("concatenates text blocks correctly", () => {
      const result = parseAndExtract(
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
      );

      // Parser correctly concatenates text blocks
      expect(result).toBe("Hello World");
    });
  });

  describe("content[] with tool_use blocks", () => {
    it("extracts tool_use input correctly", () => {
      const result = parseAndExtract(
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
      );

      // Parser extracts tool_use input as JSON
      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("Alice");
      expect(parsed.age).toBe(30);
    });
  });

  describe("choice.text fallback", () => {
    it("extracts from choice.text when message.content is absent", () => {
      const result = parseAndExtract({ choices: [{ text: "Fallback text response" }] });

      expect(result).toBe("Fallback text response");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for null result", () => {
      const result = parseAndExtract(null as any);
      expect(result).toBe("");
    });

    it("returns empty string for response without extractable content", () => {
      const result = parseAndExtract({ choices: [{ message: {} }] });
      expect(result).toBe("");
    });

    it("returns empty string for raw string result", () => {
      // Parser expects object format, strings don't have choices
      const result = parseAndExtract("raw string response" as any);
      expect(result).toBe("");
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

      const parsed = JSON.parse(result as string);
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
      const parsed = JSON.parse(result as string);
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
