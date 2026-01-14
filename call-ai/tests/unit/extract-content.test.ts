import { callAi, Schema } from "call-ai";
import { describe, expect, it, vi } from "vitest";

/**
 * extractContent() Integration Tests
 *
 * Tests the non-streaming callAi() path with all response formats
 * that extractContent() handles. Uses mock.fetch injection.
 */

describe("extractContent() response formats", () => {
  // Helper to create a mock fetch that returns JSON response
  function createJsonMockFetch(jsonResponse: object) {
    return vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(jsonResponse),
      ok: true,
      status: 200,
      statusText: "OK",
    } as unknown as Response);
  }

  describe("message.content (string)", () => {
    it("should extract simple string content", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: "Hello from AI" } }],
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe("Hello from AI");
    });

    it("should extract JSON string content", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: '{"name":"test","value":42}' } }],
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe('{"name":"test","value":42}');
    });
  });

  describe("message.tool_calls", () => {
    // TODO: Fix when swapping to NonStreamingOpenRouterParser
    it.todo("should extract tool_calls arguments with schema", async () => {
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

      // Schema strategy processes tool_calls and returns the arguments
      const parsed = JSON.parse(result);
      expect(parsed.city).toBe("Paris");
      expect(parsed.country).toBe("France");
    });
  });

  describe("message.function_call (legacy format)", () => {
    // TODO: Fix when swapping to NonStreamingOpenRouterParser
    it.todo("should extract function_call arguments with schema", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [
          {
            message: {
              function_call: {
                name: "get_weather",
                arguments: '{"temperature":72,"unit":"fahrenheit"}',
              },
            },
          },
        ],
      });

      const schema: Schema = {
        name: "weather",
        properties: {
          temperature: { type: "number" },
          unit: { type: "string" },
        },
      };

      const result = await callAi("Get weather", {
        apiKey: "test-key",
        model: "openai/gpt-4o",
        schema,
        mock: { fetch: mockFetch },
      });

      const parsed = JSON.parse(result);
      expect(parsed.temperature).toBe(72);
      expect(parsed.unit).toBe("fahrenheit");
    });
  });

  describe("Claude content[] with text blocks", () => {
    // TODO: Fix when swapping to NonStreamingOpenRouterParser
    it.todo("should extract text from content array", async () => {
      const mockFetch = createJsonMockFetch({
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
      });

      const result = await callAi("Hi", {
        apiKey: "test-key",
        mock: { fetch: mockFetch },
      });

      expect(result).toBe("Hello World");
    });
  });

  describe("Claude content[] with tool_use blocks", () => {
    // TODO: Fix when swapping to NonStreamingOpenRouterParser
    it.todo("should extract tool_use input with schema", async () => {
      const mockFetch = createJsonMockFetch({
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
      });

      const schema: Schema = {
        name: "person",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      };

      const result = await callAi("Get person", {
        apiKey: "test-key",
        model: "anthropic/claude-3-sonnet",
        schema,
        mock: { fetch: mockFetch },
      });

      const parsed = JSON.parse(result);
      expect(parsed.name).toBe("Alice");
      expect(parsed.age).toBe(30);
    });

    // TODO: Fix when swapping to NonStreamingOpenRouterParser
    it.todo("should prefer tool_use over text in content array", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [
          {
            message: {
              content: [
                { type: "text", text: "Here is the data:" },
                {
                  type: "tool_use",
                  id: "toolu_456",
                  name: "output",
                  input: { result: "from_tool" },
                },
              ],
            },
          },
        ],
      });

      const schema: Schema = {
        name: "output",
        properties: {
          result: { type: "string" },
        },
      };

      const result = await callAi("Get data", {
        apiKey: "test-key",
        model: "anthropic/claude-3-sonnet",
        schema,
        mock: { fetch: mockFetch },
      });

      const parsed = JSON.parse(result);
      expect(parsed.result).toBe("from_tool");
    });
  });

  describe("choice.text fallback", () => {
    it("should extract from choice.text when message.content is absent", async () => {
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

  describe("edge cases", () => {
    it("should handle empty content gracefully", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: "" } }],
      });

      // Empty content should throw or return empty string
      // Current behavior throws "Failed to extract content"
      await expect(
        callAi("Hi", {
          apiKey: "test-key",
          mock: { fetch: mockFetch },
        }),
      ).rejects.toThrow();
    });

    it("should handle null content gracefully", async () => {
      const mockFetch = createJsonMockFetch({
        choices: [{ message: { content: null } }],
      });

      await expect(
        callAi("Hi", {
          apiKey: "test-key",
          mock: { fetch: mockFetch },
        }),
      ).rejects.toThrow();
    });
  });
});
