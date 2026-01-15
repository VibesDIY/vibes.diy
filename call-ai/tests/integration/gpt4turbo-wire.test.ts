import fs from "fs";
import path from "path";
import { callAi, Schema, Message } from "call-ai";
import { describe, expect, it, vi } from "vitest";
import { NonStreamingOpenRouterParser, ParserEvent } from "@vibes.diy/call-ai-base";

/**
 * GPT-4 Turbo Wire Protocol Tests
 *
 * Split into two concerns:
 * - Request formatting tests: Use mock.fetch to verify request body structure
 * - Response parsing tests: Use NonStreamingOpenRouterParser directly with fixtures
 */

describe("GPT-4 Turbo Wire Protocol Tests", () => {
  const fixturesDir = path.join(__dirname, "fixtures");
  const gpt4turboSystemResponseFixture = fs.readFileSync(path.join(fixturesDir, "gpt4turbo-system-response.json"), "utf8");

  describe("Request formatting (injected mock)", () => {
    function createMockFetch(fixtureContent: string = gpt4turboSystemResponseFixture) {
      return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => fixtureContent,
        json: async () => JSON.parse(fixtureContent),
      } as Response);
    }

    it("should handle system message approach with GPT-4 Turbo", async () => {
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
        model: "openai/gpt-4-turbo",
        schema: schema,
        forceSystemMessage: true,
        mock: { fetch: mockFetch },
      });

      expect(mockFetch).toHaveBeenCalled();

      const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      // Check that we're using system messages
      expect(actualRequestBody.messages).toBeTruthy();
      expect(actualRequestBody.messages.length).toBeGreaterThanOrEqual(1);

      // Find the system message
      const systemMessage = actualRequestBody.messages.find((m: { role: string }) => m.role === "system");
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.content).toContain("title");
      expect(systemMessage.content).toContain("author");
      expect(systemMessage.content).toContain("year");
      expect(systemMessage.content).toContain("rating");

      // Verify user message is included
      const userMessage = actualRequestBody.messages.find((m: { role: string }) => m.role === "user");
      expect(userMessage).toBeTruthy();
      expect(userMessage.content).toBe("Give me a short book recommendation in the requested format.");
    });

    it("should handle schema requests with GPT-4 Turbo", async () => {
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
        model: "openai/gpt-4-turbo",
        schema: schema,
        mock: { fetch: mockFetch },
      });

      expect(mockFetch).toHaveBeenCalled();

      const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      // Check that we're sending messages
      expect(actualRequestBody.messages).toBeTruthy();
      expect(actualRequestBody.messages.length).toBeGreaterThan(0);

      // Verify user message is included
      const userMessage = actualRequestBody.messages.find((m: { role: string }) => m.role === "user");
      expect(userMessage).toBeTruthy();
      expect(userMessage.content).toBe("Give me a short book recommendation in the requested format.");
    });

    it("should pass through message array directly", async () => {
      const mockFetch = createMockFetch();

      const messages: Message[] = [
        {
          role: "system",
          content:
            'Please generate structured JSON responses that follow this exact schema:\n{\n  "title": string,\n  "author": string,\n  "year": number,\n  "genre": string,\n  "rating": number (between 1-5)\n}\nDo not include any explanation or text outside of the JSON object.',
        },
        {
          role: "user",
          content: "Give me a short book recommendation. Respond with only valid JSON matching the schema.",
        },
      ];

      await callAi(messages, {
        apiKey: "test-api-key",
        model: "openai/gpt-4-turbo",
        mock: { fetch: mockFetch },
      });

      expect(mockFetch).toHaveBeenCalled();

      const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      // Verify messages are passed through correctly
      expect(actualRequestBody.messages).toEqual(messages);
    });
  });

  describe("Response parsing (parser-based)", () => {
    it("should parse GPT-4 Turbo response and extract JSON content", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: ParserEvent[] = [];

      parser.onEvent((evt) => events.push(evt));
      parser.parse(JSON.parse(gpt4turboSystemResponseFixture));

      const meta = events.find((e) => e.type === "or.meta");
      const delta = events.find((e) => e.type === "or.delta");
      const done = events.find((e) => e.type === "or.done");
      const usage = events.find((e) => e.type === "or.usage");

      // Verify metadata
      expect(meta?.type).toBe("or.meta");
      if (meta?.type === "or.meta") {
        expect(meta.model).toBe("openai/gpt-4-turbo");
        expect(meta.provider).toBe("OpenAI");
      }

      // Verify content extraction - GPT-4 Turbo returns JSON
      expect(delta?.type).toBe("or.delta");
      if (delta?.type === "or.delta") {
        const parsed = JSON.parse(delta.content);
        expect(parsed.title).toBe("The Great Gatsby");
        expect(parsed.author).toBe("F. Scott Fitzgerald");
        expect(parsed.year).toBe(1925);
        expect(parsed.genre).toBe("Novel");
        expect(parsed.rating).toBe(4.5);
      }

      // Verify finish reason
      expect(done?.type).toBe("or.done");
      if (done?.type === "or.done") {
        expect(done.finishReason).toBe("stop");
      }

      // Verify usage
      expect(usage?.type).toBe("or.usage");
      if (usage?.type === "or.usage") {
        expect(usage.promptTokens).toBe(89);
        expect(usage.completionTokens).toBe(48);
        expect(usage.totalTokens).toBe(137);
      }
    });
  });
});
