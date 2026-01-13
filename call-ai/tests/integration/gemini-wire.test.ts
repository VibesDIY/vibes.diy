import fs from "fs";
import path from "path";
import { callAi, Schema, Message } from "call-ai";
import { describe, expect, it, vi } from "vitest";

/**
 * Gemini Wire Protocol Tests
 *
 * Tests request formatting for Gemini models.
 * Uses mock.fetch injection instead of global stubbing.
 */

describe("Gemini Wire Protocol Tests (injected mock)", () => {
  const geminiSystemResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/gemini-system-response.json"), "utf8");

  const geminiResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/gemini-response.json"), "utf8");

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

  it("should correctly handle Gemini response with schema", async () => {
    const mockFetch = createMockFetch(geminiResponseFixture);

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

    const result = await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "google/gemini-2.0-flash-001",
      schema: schema,
      mock: { fetch: mockFetch },
    });

    expect(result).toBeTruthy();

    // Gemini might return content with code blocks
    if (typeof result === "string") {
      // Check if the result includes code blocks
      const cleanResult = result.includes("```") ? result.replace(/```json\n|\n```|```\n|\n```/g, "") : result;

      // Parse the content as JSON and validate
      const parsed = JSON.parse(cleanResult);
      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("author");
      expect(parsed).toHaveProperty("year");
      expect(parsed).toHaveProperty("genre");
      expect(parsed).toHaveProperty("rating");
    } else if (typeof result === "object") {
      // If it returns an object directly
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("author");
      expect(result).toHaveProperty("year");
      expect(result).toHaveProperty("genre");
      expect(result).toHaveProperty("rating");
    }
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

  it("should correctly handle Gemini response with system message", async () => {
    const mockFetch = createMockFetch();

    const result = await callAi(
      [
        {
          role: "system",
          content:
            'Please generate structured JSON responses that follow this exact schema:\n{\n  "title": string,\n  "author": string,\n  "year": number,\n  "genre": string,\n  "rating": number (between 1-5)\n}\nDo not include any explanation or text outside of the JSON object.',
        },
        {
          role: "user",
          content: "Give me a short book recommendation. Respond with only valid JSON matching the schema.",
        },
      ] as Message[],
      {
        apiKey: "test-api-key",
        model: "google/gemini-2.0-flash-001",
        mock: { fetch: mockFetch },
      },
    );

    expect(result).toBeTruthy();

    if (typeof result === "string") {
      // Handle possible markdown code blocks in the response
      const jsonMatch = (result as string).match(/```json\s*([\s\S]*?)\s*```/) ||
        (result as string).match(/```\s*([\s\S]*?)\s*```/) || [null, result as string];

      const jsonContent = jsonMatch[1] || (result as string);

      // If the result is a string, it should be valid JSON
      const parsed = JSON.parse(jsonContent);
      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("author");
      expect(parsed).toHaveProperty("year");
      expect(parsed).toHaveProperty("genre");
      expect(parsed).toHaveProperty("rating");
    } else if (typeof result === "object") {
      // If it returns an object directly
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("author");
      expect(result).toHaveProperty("year");
      expect(result).toHaveProperty("genre");
      expect(result).toHaveProperty("rating");
    }
  });

  it("should handle schema when response_format schema is supported", async () => {
    const mockFetch = createMockFetch(geminiResponseFixture);

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

    // Check that we're using response_format.json_schema approach instead
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
});
