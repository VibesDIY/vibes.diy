import fs from "fs";
import path from "path";
import { callAi, Schema, Message } from "call-ai";
import { describe, expect, it, vi } from "vitest";
import { NonStreamingOpenRouterParser, OrEvent } from "../../pkg/parser/index.js";

/**
 * Gemini Wire Protocol Tests
 *
 * Split into two concerns:
 * - Request formatting tests: Use mock.fetch to verify request body structure
 * - Response parsing tests: Use NonStreamingOpenRouterParser directly with fixtures
 */

describe("Gemini Wire Protocol Tests", () => {
  const fixturesDir = path.join(__dirname, "fixtures");
  const geminiSystemResponseFixture = fs.readFileSync(path.join(fixturesDir, "gemini-system-response.json"), "utf8");
  const geminiResponseFixture = fs.readFileSync(path.join(fixturesDir, "gemini-response.json"), "utf8");

  describe("Request formatting (injected mock)", () => {
    function createMockFetch(fixtureContent: string = geminiSystemResponseFixture) {
      return vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => fixtureContent,
        json: async () => JSON.parse(fixtureContent),
      } as Response);
    }

    it("should use the JSON schema format by default for Gemini with schema", async () => {
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
        model: "google/gemini-2.0-flash-001",
        schema: schema,
        mock: { fetch: mockFetch },
      });

      expect(mockFetch).toHaveBeenCalled();

      const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      // Check that we're using JSON Schema format since Gemini is not Claude
      expect(actualRequestBody.response_format).toBeTruthy();
      expect(actualRequestBody.response_format.type).toBe("json_schema");
      expect(actualRequestBody.response_format.json_schema).toBeTruthy();
      expect(actualRequestBody.response_format.json_schema.name).toBe("book_recommendation");

      // Verify schema structure
      const schemaObj = actualRequestBody.response_format.json_schema.schema;
      expect(schemaObj.type).toBe("object");
      expect(schemaObj.properties).toBeTruthy();
      expect(schemaObj.properties.title).toBeTruthy();
      expect(schemaObj.properties.author).toBeTruthy();
      expect(schemaObj.properties.year).toBeTruthy();
      expect(schemaObj.properties.genre).toBeTruthy();
      expect(schemaObj.properties.rating).toBeTruthy();
    });

    it("should pass through system messages directly", async () => {
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
        model: "google/gemini-2.0-flash-001",
        mock: { fetch: mockFetch },
      });

      expect(mockFetch).toHaveBeenCalled();

      const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      // Verify messages are passed through correctly
      expect(actualRequestBody.messages).toEqual(messages);
    });
  });

  describe("Response parsing (parser-based)", () => {
    it("should parse Gemini response and extract JSON content", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];

      parser.onEvent((evt) => events.push(evt));
      parser.parse(JSON.parse(geminiResponseFixture));

      const meta = events.find((e) => e.type === "or.meta");
      const delta = events.find((e) => e.type === "or.delta");
      const done = events.find((e) => e.type === "or.done");
      const usage = events.find((e) => e.type === "or.usage");

      // Verify metadata
      expect(meta?.type).toBe("or.meta");
      if (meta?.type === "or.meta") {
        expect(meta.model).toBe("google/gemini-2.0-flash-001");
        expect(meta.provider).toBe("Google");
      }

      // Verify content extraction - Gemini returns JSON
      expect(delta?.type).toBe("or.delta");
      if (delta?.type === "or.delta") {
        const parsed = JSON.parse(delta.content);
        expect(parsed.author).toBe("Ursula K. Le Guin");
        expect(parsed.title).toBe("The Left Hand of Darkness");
        expect(parsed.year).toBe(1969);
        expect(parsed.genre).toBe("Science Fiction");
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
        expect(usage.promptTokens).toBe(21);
        expect(usage.completionTokens).toBe(56);
        expect(usage.totalTokens).toBe(77);
      }
    });

    it("should parse Gemini system response with JSON content (markdown wrapped)", () => {
      const parser = new NonStreamingOpenRouterParser();
      let content = "";

      parser.onEvent((evt) => {
        if (evt.type === "or.delta") content = evt.content;
      });

      parser.parse(JSON.parse(geminiSystemResponseFixture));

      // Gemini with system message may return JSON wrapped in markdown code blocks
      // Strip the code blocks before parsing
      const jsonContent = content.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(jsonContent);
      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("author");
      expect(parsed).toHaveProperty("year");
      expect(parsed).toHaveProperty("genre");
      expect(parsed).toHaveProperty("rating");
    });
  });
});
