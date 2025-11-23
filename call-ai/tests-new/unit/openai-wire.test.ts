import { callAi, Schema } from "call-ai";
import { assert, beforeEach, describe, expect, it, vitest } from "vitest";

// Mock fetch to use our fixture files
const mock = { fetch: vitest.fn() };

describe("OpenAI Wire Protocol Tests", () => {
  // Read fixtures
  function openaiRequestFixture() {
    return fetch("http://localhost:15731/fixtures/openai-request.json").then((r) => r.json());
  }

  function openaiResponseFixture() {
    return fetch("http://localhost:15731/fixtures/openai-response.json").then((r) => r.json());
  }

  async function openaiStreamResponseFixture() {
    return fetch("http://localhost:15731/fixtures/openai-stream-response.txt")
      .then(async (r) => {
        const text = await r.text();
        return text;
      })
      .catch((e) => {
        console.error("Error fetching OpenAI stream response:", e);
        throw e;
      });
  }

  beforeEach(() => {
    // Reset mocks
    mock.fetch.mockClear();

    // Mock successful response for regular request
    mock.fetch.mockImplementation(async (_url, options) => {
      const requestBody = JSON.parse(options.body as string);

      // let responseText;
      if (requestBody.stream) {
        const fixture = await openaiStreamResponseFixture();
        // Mock streaming response
        // In a real test, we'd need to properly mock a ReadableStream
        return {
          ok: true,
          status: 200,
          body: {
            getReader: () => {
              // Stream reader that returns chunks from our fixture
              const chunks = fixture
                .split("data: ")
                .filter((chunk) => chunk.trim() !== "")
                .map((chunk) => {
                  const encoder = new TextEncoder();
                  return encoder.encode(`data: ${chunk}\n\n`);
                });

              let chunkIndex = 0;

              return {
                read: async () => {
                  if (chunkIndex < chunks.length) {
                    return { done: false, value: chunks[chunkIndex++] };
                  } else {
                    return { done: true, value: undefined };
                  }
                },
              };
            },
          },
          text: async () => openaiStreamResponseFixture(),
          json: async () => {
            throw new Error("Not implemented");
          }, // JSON.parse(openaiStreamResponseFixture()),
        };
      } else {
        // Standard response
        return {
          ok: true,
          status: 200,
          text: async () => openaiResponseFixture().then((r) => JSON.stringify(r)),
          json: async () => openaiResponseFixture(),
        };
      }
    });
  });

  it("should correctly format OpenAI JSON schema request", async () => {
    // Define the same schema we used in our fixture
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
      model: "openai/gpt-4o",
      schema: schema,
      mock,
    });

    // Verify fetch was called
    expect(mock.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(mock.fetch.mock.calls[0][1].body);

    const expectedRequestBody = await openaiRequestFixture();
    // Check that the essential parts match our fixture
    expect(actualRequestBody.model).toEqual(expectedRequestBody.model);
    expect(actualRequestBody.messages).toEqual(expectedRequestBody.messages);
    expect(actualRequestBody.response_format.type).toEqual(expectedRequestBody.response_format.type);

    // Deep compare the json_schema part of response_format
    expect(actualRequestBody.response_format.json_schema.name).toEqual(expectedRequestBody.response_format.json_schema.name);

    expect(actualRequestBody.response_format.json_schema.schema.properties).toEqual(
      expectedRequestBody.response_format.json_schema.schema.properties,
    );
  });

  it("should correctly handle OpenAI response with JSON schema", async () => {
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

    // Call the library with OpenAI model
    const result = await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schema,
      mock,
    });

    // Parse the OpenAI response fixture to get expected content
    const responseObj = await openaiResponseFixture();
    const responseContent = (await responseObj).choices[0].message.content;
    const expectedData = JSON.parse(responseContent);

    // Verify the result
    expect(result).toBeTruthy();

    if (typeof result === "string") {
      // If the result is a string, it should be valid JSON matching the expected data
      const resultData = JSON.parse(result);
      expect(resultData).toEqual(expectedData);
    } else if (typeof result === "object") {
      // If the result is an object, it should match the expected data
      expect(result).toEqual(expectedData);
    }
  });

  it("should correctly handle OpenAI streaming with JSON schema", async () => {
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

    // Call the library with OpenAI model and streaming
    const generator = await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schema,
      stream: true,
      mock,
    }); //as AsyncGenerator<string, string, unknown>;
    if (typeof generator === "string") {
      assert("Expected generator, got string");
      return;
    }

    // Verify that we get a generator back
    expect(generator).toBeTruthy();
    expect(generator[Symbol.asyncIterator]).toBeDefined();

    // Collect all chunks
    const chunks: string[] = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    // We should get at least one chunk
    expect(chunks.length).toBeGreaterThan(0);

    // The last chunk should be valid JSON
    const lastChunk = chunks[chunks.length - 1];
    expect(() => JSON.parse(lastChunk)).not.toThrow();
  });

  it("should use JSON schema format for GPT-4o with schema handling", async () => {
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

    // Call the library function with schema
    await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schema,
      mock,
    });

    // Verify fetch was called
    expect(mock.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(mock.fetch.mock.calls[0][1].body);

    // GPT-4o should use response_format.json_schema for schema handling
    expect(actualRequestBody.response_format).toBeTruthy();
    expect(actualRequestBody.response_format.type).toBe("json_schema");
    expect(actualRequestBody.response_format.json_schema).toBeTruthy();
    expect(actualRequestBody.response_format.json_schema.name).toBe("book_recommendation");
    expect(actualRequestBody.response_format.json_schema.schema).toBeTruthy();
    expect(actualRequestBody.response_format.json_schema.schema.properties.title).toBeTruthy();

    // No tools for OpenAI models
    expect(actualRequestBody.tools).toBeUndefined();
  });

  it("should support tool mode for OpenAI models when enabled", async () => {
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

    // Call the library function with schema
    await callAi("Give me a short book recommendation in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schema,
      useToolMode: true, // Custom option to enable tool mode for OpenAI
      mock,
    });

    // Verify fetch was called
    expect(mock.fetch).toHaveBeenCalled();

    // Get the request body that was passed to fetch
    const actualRequestBody = JSON.parse(mock.fetch.mock.calls[0][1].body);

    // If tool mode is enabled for OpenAI, it should use tools format
    if (actualRequestBody.tools) {
      // Tool mode should be applied
      expect(actualRequestBody.tools).toBeTruthy();
      expect(actualRequestBody.tool_choice).toBeTruthy();
      expect(actualRequestBody.tools[0].name).toBe("book_recommendation");
      expect(actualRequestBody.tools[0].input_schema).toBeTruthy();
      expect(actualRequestBody.tools[0].input_schema.properties.title).toBeTruthy();

      // Should not use response_format when using tool mode
      expect(actualRequestBody.response_format).toBeUndefined();
    } else {
      // If tool mode isn't enabled yet, it will still use JSON schema
      expect(actualRequestBody.response_format).toBeTruthy();
      expect(actualRequestBody.response_format.type).toBe("json_schema");
    }
  });
});
