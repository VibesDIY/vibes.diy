import fs from "fs";
import path from "path";
import { callAi, Schema, Message } from "call-ai";
import { describe, expect, it, vi } from "vitest";

/**
 * GPT-4 Turbo Wire Protocol Tests
 *
 * Tests request formatting for GPT-4 Turbo models.
 * Uses mock.fetch injection instead of global stubbing.
 */

describe("GPT-4 Turbo Wire Protocol Tests (injected mock)", () => {
  const gpt4turboSystemResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/gpt4turbo-system-response.json"), "utf8");

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

  it("should correctly handle GPT-4 Turbo response with system message", async () => {
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
        model: "openai/gpt-4-turbo",
        mock: { fetch: mockFetch },
      },
    );

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

    const result = await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4-turbo",
      schema: schema,
      mock: { fetch: mockFetch },
    });

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
});
