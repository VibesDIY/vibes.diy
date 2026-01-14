import fs from "fs";
import path from "path";
import { callAi, Schema } from "call-ai";
import { describe, it, expect, vi } from "vitest";
import { NonStreamingOpenRouterParser, OrEvent } from "../../pkg/parser/index.js";

/**
 * Llama3 Wire Protocol Tests
 *
 * Split into two concerns:
 * - Request formatting tests: Use mock.fetch to verify request body structure
 * - Response parsing tests: Use NonStreamingOpenRouterParser directly with fixtures
 */

describe("Llama3 Wire Protocol Tests", () => {
  const fixturesDir = path.join(__dirname, "fixtures");
  const llama3ResponseFixture = fs.readFileSync(path.join(fixturesDir, "llama3-response.json"), "utf8");
  const llama3SystemResponseFixture = fs.readFileSync(path.join(fixturesDir, "llama3-system-response.json"), "utf8");

  describe("Request formatting (injected mock)", () => {
    function createMockFetch(fixtureContent: string = llama3ResponseFixture) {
      return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => fixtureContent,
        json: async () => JSON.parse(fixtureContent),
      } as Response);
    }

    it("should use the system message approach for Llama3 with schema", async () => {
      const mockFetch = createMockFetch();

      const schema: Schema = {
        name: "book_recommendation",
        properties: {
          title: { type: "string" },
          author: { type: "string" },
          year: { type: "number" },
          genre: { type: "string" },
          rating: { type: "number", minimum: 1, maximum: 5 },
        },
      };

      await callAi("Give me a short book recommendation in the requested format.", {
        apiKey: "test-api-key",
        model: "meta-llama/llama-3.3-70b-instruct",
        schema: schema,
        mock: { fetch: mockFetch },
      });

      expect(mockFetch).toHaveBeenCalled();

      const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      // Check that we're using system message approach rather than JSON schema format
      expect(actualRequestBody.messages).toBeTruthy();
      expect(actualRequestBody.messages.length).toBeGreaterThan(1);

      // Check for system message with schema info
      const systemMessage = actualRequestBody.messages.find((m: { role: string }) => m.role === "system");
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.content).toContain("title");
      expect(systemMessage.content).toContain("author");
      expect(systemMessage.content).toContain("year");
      expect(systemMessage.content).toContain("genre");
      expect(systemMessage.content).toContain("rating");

      // Verify user message is included
      const userMessage = actualRequestBody.messages.find((m: { role: string }) => m.role === "user");
      expect(userMessage).toBeTruthy();
      expect(userMessage.content).toBe("Give me a short book recommendation in the requested format.");

      // Verify response_format is not used (Llama3 uses system message approach)
      expect(actualRequestBody.response_format).toBeUndefined();
    });
  });

  describe("Response parsing (parser-based)", () => {
    it("should parse Llama3 response and extract content", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];

      parser.onEvent((evt) => events.push(evt));
      parser.parse(JSON.parse(llama3ResponseFixture));

      const meta = events.find((e) => e.type === "or.meta");
      const delta = events.find((e) => e.type === "or.delta");
      const done = events.find((e) => e.type === "or.done");
      const usage = events.find((e) => e.type === "or.usage");

      // Verify metadata
      expect(meta?.type).toBe("or.meta");
      if (meta?.type === "or.meta") {
        expect(meta.model).toBe("meta-llama/llama-3.3-70b-instruct");
        expect(meta.provider).toBe("SambaNova");
      }

      // Verify content extraction
      expect(delta?.type).toBe("or.delta");
      if (delta?.type === "or.delta") {
        expect(delta.content).toContain("Hitchhiker's Guide");
        expect(delta.content).toContain("Douglas Adams");
      }

      // Verify finish reason
      expect(done?.type).toBe("or.done");
      if (done?.type === "or.done") {
        expect(done.finishReason).toBe("stop");
      }

      // Verify usage
      expect(usage?.type).toBe("or.usage");
      if (usage?.type === "or.usage") {
        expect(usage.promptTokens).toBe(21);
        expect(usage.completionTokens).toBe(79);
        expect(usage.totalTokens).toBe(100);
      }
    });

    it("should parse Llama3 system response with JSON content", () => {
      const parser = new NonStreamingOpenRouterParser();
      let content = "";

      parser.onEvent((evt) => {
        if (evt.type === "or.delta") content = evt.content;
      });

      parser.parse(JSON.parse(llama3SystemResponseFixture));

      // Llama3 with system message can return proper JSON
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("author");
      expect(parsed).toHaveProperty("year");
      expect(parsed).toHaveProperty("genre");
      expect(parsed).toHaveProperty("rating");
    });
  });
});
