import fs from "fs";
import path from "path";
import { callAi, Schema, Message } from "call-ai";
import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock fetch to use our fixture files
const global = globalThis;
const globalFetch = vi.fn<typeof fetch>();
global.fetch = globalFetch;

describe("GPT-4 Turbo Wire Protocol Tests", () => {
  // Read fixtures
  // const gpt4turboSystemRequestFixture = JSON.parse(
  //   fs.readFileSync(
  //     path.join(__dirname, "fixtures/gpt4turbo-system-request.json"),
  //     "utf8",
  //   ),
  // );

  const gpt4turboSystemResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/gpt4turbo-system-response.json"), "utf8");

  beforeEach(() => {
    // Reset mocks
    globalFetch.mockClear();

    // Mock successful response
    globalFetch.mockImplementation(async (_url, _options) => {
      return {
        ok: true,
        status: 200,
        text: async () => gpt4turboSystemResponseFixture,
        json: async () => JSON.parse(gpt4turboSystemResponseFixture),
      } as Response;
    });
  });

  it("should handle system message approach with GPT-4 Turbo", async () => {
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

    // Call the library function with the schema using system message approach
    await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4-turbo",
      schema: schema,
      forceSystemMessage: true,
    });

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(globalFetch.mock.calls[0][1]?.body as string);

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

  it("should correctly handle GPT-4 Turbo response with system message", async () => {
    // Call the library with system messages
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
        model: "openai/gpt-4-turbo",
      }
    );

    // Verify the result
    expect(result).toBeTruthy();

    if (typeof result === "string") {
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult).toHaveProperty("title");
      expect(parsedResult).toHaveProperty("author");
      expect(parsedResult).toHaveProperty("year");
      expect(parsedResult).toHaveProperty("genre");
      expect(parsedResult).toHaveProperty("rating");
    } else if (typeof result === "object") {
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("author");
      expect(result).toHaveProperty("year");
      expect(result).toHaveProperty("genre");
      expect(result).toHaveProperty("rating");
    }
  });

  it("should use system message approach when schema is provided to GPT-4 Turbo", async () => {
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
    const result = await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4-turbo",
      schema: schema,
    });

    // Verify the result
    expect(result).toBeTruthy();

    // Parse the response and verify structure
    if (typeof result === "string") {
      const parsedResult = JSON.parse(result as string);
      expect(parsedResult).toHaveProperty("title");
      expect(parsedResult).toHaveProperty("author");
      expect(parsedResult).toHaveProperty("year");
      expect(parsedResult).toHaveProperty("genre");
      expect(parsedResult).toHaveProperty("rating");
    } else if (typeof result === "object") {
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("author");
      expect(result).toHaveProperty("year");
      expect(result).toHaveProperty("genre");
      expect(result).toHaveProperty("rating");
    }
  });

  it("should handle schema requests with GPT-4 Turbo", async () => {
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
      model: "openai/gpt-4-turbo",
      schema: schema,
    });

    // Verify fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(globalFetch.mock.calls[0][1]?.body as string);

    // Check that we're sending messages
    expect(actualRequestBody.messages).toBeTruthy();
    expect(actualRequestBody.messages.length).toBeGreaterThan(0);

    // Verify user message is included
    const userMessage = actualRequestBody.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage).toBeTruthy();
    expect(userMessage.content).toBe("Give me a short book recommendation in the requested format.");
  });
});
