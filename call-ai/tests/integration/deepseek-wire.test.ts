import fs from "fs";
import path from "path";
import { callAi, Schema } from "call-ai";
import { describe, expect, it, vi } from "vitest";
import { NonStreamingOpenRouterParser, ParserEvent } from "../../pkg/parser/index.js";

/**
 * DeepSeek Wire Protocol Tests
 *
 * Split into two concerns:
 * - Request formatting tests: Use mock.fetch to verify request body structure
 * - Response parsing tests: Use NonStreamingOpenRouterParser directly with fixtures
 */

describe("DeepSeek Wire Protocol Tests", () => {
  const fixturesDir = path.join(__dirname, "fixtures");
  const deepseekResponseFixture = fs.readFileSync(path.join(fixturesDir, "deepseek-response.json"), "utf8");
  const deepseekSystemResponseFixture = fs.readFileSync(path.join(fixturesDir, "deepseek-system-response.json"), "utf8");

  describe("Request formatting (injected mock)", () => {
    function createMockFetch(fixtureContent: string = deepseekResponseFixture) {
      return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => fixtureContent,
        json: async () => JSON.parse(fixtureContent),
      } as Response);
    }

    it("should use the system message approach for DeepSeek with schema", async () => {
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
        model: "deepseek/deepseek-chat",
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

      // Verify response_format is not used (DeepSeek uses system message approach)
      expect(actualRequestBody.response_format).toBeUndefined();
    });
  });

  describe("Response parsing (parser-based)", () => {
    it("should parse DeepSeek response and extract content", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: ParserEvent[] = [];

      parser.onEvent((evt) => events.push(evt));
      parser.parse(JSON.parse(deepseekResponseFixture));

      const meta = events.find((e) => e.type === "or.meta");
      const delta = events.find((e) => e.type === "or.delta");
      const done = events.find((e) => e.type === "or.done");
      const usage = events.find((e) => e.type === "or.usage");

      // Verify metadata
      expect(meta?.type).toBe("or.meta");
      if (meta?.type === "or.meta") {
        expect(meta.model).toBe("deepseek/deepseek-chat");
        expect(meta.provider).toBe("Nebius");
      }

      // Verify content extraction
      expect(delta?.type).toBe("or.delta");
      if (delta?.type === "or.delta") {
        expect(delta.content).toContain("The Alchemist");
        expect(delta.content).toContain("Paulo Coelho");
      }

      // Verify finish reason
      expect(done?.type).toBe("or.done");
      if (done?.type === "or.done") {
        expect(done.finishReason).toBe("stop");
      }

      // Verify usage
      expect(usage?.type).toBe("or.usage");
      if (usage?.type === "or.usage") {
        expect(usage.promptTokens).toBe(14);
        expect(usage.completionTokens).toBe(84);
        expect(usage.totalTokens).toBe(98);
      }
    });

    it("should parse DeepSeek system response with JSON content", () => {
      const parser = new NonStreamingOpenRouterParser();
      let content = "";

      parser.onEvent((evt) => {
        if (evt.type === "or.delta") content = evt.content;
      });

      parser.parse(JSON.parse(deepseekSystemResponseFixture));

      // DeepSeek with system message returns proper JSON
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("author");
      expect(parsed).toHaveProperty("year");
      expect(parsed).toHaveProperty("genre");
      expect(parsed).toHaveProperty("rating");
    });
  });
});
