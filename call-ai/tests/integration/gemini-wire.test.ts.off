import fs from "fs";
import path from "path";
import { callAi, Schema, Message } from "call-ai";
import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock fetch to use our fixture files
// Mock global fetch
const globalFetch = vi.fn<typeof fetch>();
global.fetch = globalFetch as typeof fetch;

describe("Gemini Wire Protocol Tests", () => {
  // Read fixtures
  // const geminiSystemRequestFixture = JSON.parse(
  //   fs.readFileSync(
  //     path.join(__dirname, "fixtures/gemini-system-request.json"),
  //     "utf8",
  //   ),
  // );

  const geminiSystemResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/gemini-system-response.json"), "utf8");

  // const geminiRequestFixture = JSON.parse(
  //   fs.readFileSync(
  //     path.join(__dirname, "fixtures/gemini-request.json"),
  //     "utf8",
  //   ),
  // );

  const geminiResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/gemini-response.json"), "utf8");

  beforeEach(() => {
    // Reset mocks
    globalFetch.mockClear();

    // Mock successful response
    globalFetch.mockImplementation(async (_url, _options) => {
      return {
        ok: true,
        status: 200,
        text: async () => geminiSystemResponseFixture,
        json: async () => JSON.parse(geminiSystemResponseFixture),
      } as Response;
    });
  });

  it("should use the JSON schema format by default for Gemini with schema", async () => {
    // Define schema
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

    // Call the library function with the schema
    await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "google/gemini-2.0-flash-001",
      schema: schema,
    });

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(globalFetch.mock.calls[0][1]?.body as string);

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
    // Update mock to return proper response
    globalFetch.mockImplementationOnce(async (_url, _options) => {
      return {
        ok: true,
        status: 200,
        text: async () => geminiResponseFixture,
        json: async () => JSON.parse(geminiResponseFixture),
      } as Response;
    });

    // Define the schema
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

    // Call the library with Gemini model
    const result = await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "google/gemini-2.0-flash-001",
      schema: schema,
    });

    // Parse the Gemini response fixture to get expected content
    // const responseObj = JSON.parse(geminiResponseFixture);
    // const responseContent = responseObj.choices[0].message.content;

    // Verify the result
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
    // Call the library with messages array including system message
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
    });

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(globalFetch.mock.calls[0][1]?.body as string);

    // Verify messages are passed through correctly
    expect(actualRequestBody.messages).toEqual(messages);
  });

  it("should correctly handle Gemini response with system message", async () => {
    // Call the library with messages array including system message
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
      }
    );

    // Verify the result
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
    // Override the mock for this specific test
    globalFetch.mockImplementationOnce(async (_url, _options) => {
      return {
        ok: true,
        status: 200,
        text: async () => geminiResponseFixture,
        json: async () => JSON.parse(geminiResponseFixture),
      } as Response;
    });

    // Define schema
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

    // Call the library function with schema format set to true to test fallback
    await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "google/gemini-2.0-flash-001",
      schema: schema,
    });

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(globalFetch.mock.calls[0][1]?.body as string);

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
