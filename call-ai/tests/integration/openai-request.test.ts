import fs from "fs";
import path from "path";
import { callAi, Schema } from "call-ai";
import { describe, it, expect, vi } from "vitest";

/**
 * OpenAI Request Formatting Tests
 *
 * Tests that callAi builds correct request body for OpenAI models.
 * Uses mock.fetch injection instead of global stubbing.
 */

describe("OpenAI Request Formatting (injected mock)", () => {
  const openaiRequestFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/openai-request.json"), "utf8"));

  const openaiResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/openai-response.json"), "utf8");

  function createMockFetch() {
    return vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => openaiResponseFixture,
      json: async () => JSON.parse(openaiResponseFixture),
    } as Response);
  }

  it("should correctly format OpenAI JSON schema request", async () => {
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
      model: "openai/gpt-4o",
      schema: schema,
      mock: { fetch: mockFetch },
    });

    expect(mockFetch).toHaveBeenCalled();

    const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

    expect(actualRequestBody.model).toEqual(openaiRequestFixture.model);
    expect(actualRequestBody.messages).toEqual(openaiRequestFixture.messages);
    expect(actualRequestBody.response_format.type).toEqual(openaiRequestFixture.response_format.type);
    expect(actualRequestBody.response_format.json_schema.name).toEqual(openaiRequestFixture.response_format.json_schema.name);
    expect(actualRequestBody.response_format.json_schema.schema.properties).toEqual(
      openaiRequestFixture.response_format.json_schema.schema.properties,
    );
  });

  it("should use JSON schema format for GPT-4o with schema handling", async () => {
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
      model: "openai/gpt-4o",
      schema: schema,
      mock: { fetch: mockFetch },
    });

    expect(mockFetch).toHaveBeenCalled();

    const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

    expect(actualRequestBody.response_format).toBeTruthy();
    expect(actualRequestBody.response_format.type).toBe("json_schema");
    expect(actualRequestBody.response_format.json_schema).toBeTruthy();
    expect(actualRequestBody.response_format.json_schema.name).toBe("book_recommendation");
    expect(actualRequestBody.response_format.json_schema.schema).toBeTruthy();
    expect(actualRequestBody.response_format.json_schema.schema.properties.title).toBeTruthy();
    expect(actualRequestBody.tools).toBeUndefined();
  });

  it("should support tool mode for OpenAI models when enabled", async () => {
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
      model: "openai/gpt-4o",
      schema: schema,
      useToolMode: true,
      mock: { fetch: mockFetch },
    });

    expect(mockFetch).toHaveBeenCalled();

    const actualRequestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

    if (actualRequestBody.tools) {
      expect(actualRequestBody.tools).toBeTruthy();
      expect(actualRequestBody.tool_choice).toBeTruthy();
      expect(actualRequestBody.tools[0].name).toBe("book_recommendation");
      expect(actualRequestBody.tools[0].input_schema).toBeTruthy();
      expect(actualRequestBody.tools[0].input_schema.properties.title).toBeTruthy();
      expect(actualRequestBody.response_format).toBeUndefined();
    } else {
      expect(actualRequestBody.response_format).toBeTruthy();
      expect(actualRequestBody.response_format.type).toBe("json_schema");
    }
  });
});
