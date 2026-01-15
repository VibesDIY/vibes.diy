import { callAi, Message, Schema } from "@vibes.diy/call-ai-base";
import { dotenv } from "zx";
import { describe, expect, it, vi } from "vitest";
import { fail } from "assert";

dotenv.config();

/**
 * callAi Unit Tests (no-await variant)
 *
 * Tests callAi functionality without awaiting streaming calls.
 * Uses mock.fetch injection instead of global stubbing.
 */

describe("callAi (injected mock, no-await)", () => {
  // Helper to create a mock fetch that returns JSON response
  function createJsonMockFetch(jsonResponse: object) {
    return vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(jsonResponse),
      ok: true,
      status: 200,
      statusText: "OK",
    } as unknown as Response);
  }

  // Helper to create a mock fetch with streaming body
  function createStreamMockFetch(reader: { read: ReturnType<typeof vi.fn>; releaseLock: ReturnType<typeof vi.fn> }) {
    return vi.fn().mockResolvedValue({
      body: {
        getReader: vi.fn().mockReturnValue(reader),
      },
      ok: true,
      status: 200,
      statusText: "OK",
    } as unknown as Response);
  }

  it("should handle null content gracefully for non-streaming", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: null } }],
    });

    // Parser returns empty string for null content (no longer throws)
    const result = await callAi("Hello, AI", { apiKey: "mock-key", mock: { fetch: mockFetch } });
    expect(result).toBe("");
  });

  it("should handle API key requirement for streaming", async () => {
    const mockReader = {
      read: vi.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>().mockResolvedValueOnce({ done: true }),
      releaseLock: vi.fn(),
    };
    const mockFetch = createStreamMockFetch(mockReader);

    const result = await callAi("Hello, AI", {
      stream: true,
      apiKey: "mock-key",
      mock: { fetch: mockFetch },
    });
    expect(result).toBeDefined();
  });

  it("should make POST request with correct parameters for non-streaming", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: "Hello, I am an AI" } }],
    });

    const prompt = "Hello, AI";
    const options = {
      apiKey: "test-api-key",
      model: "test-model",
      temperature: 0.7,
      mock: { fetch: mockFetch },
    };

    await callAi(prompt, options);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-api-key");
    expect(headers.get("HTTP-Referer")).toBe("https://vibes.diy");
    expect(headers.get("X-Title")).toBe("Vibes");
    expect(headers.get("Content-Type")).toBe("application/json");

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.model).toBe("test-model");
    expect(body.messages).toEqual([{ role: "user", content: "Hello, AI" }]);
    expect(body.temperature).toBe(0.7);
    expect(body.stream).toBe(false);
  });

  it("should make POST request with correct parameters for streaming", async () => {
    const mockReader = {
      read: vi.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>().mockResolvedValueOnce({ done: true }),
      releaseLock: vi.fn(),
    };
    const mockFetch = createStreamMockFetch(mockReader);

    const prompt = "Hello, AI";
    const options = {
      apiKey: "test-api-key",
      model: "test-model",
      temperature: 0.7,
      stream: true,
      mock: { fetch: mockFetch },
    };

    const generator = callAi(prompt, options) as unknown as AsyncGenerator<string, string, unknown>;
    await generator.next();

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.model).toBe("test-model");
    expect(body.messages).toEqual([{ role: "user", content: "Hello, AI" }]);
    expect(body.temperature).toBe(0.7);
    expect(body.stream).toBe(true);
  });

  it("should handle message array for prompt", async () => {
    const mockReader = {
      read: vi.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>().mockResolvedValueOnce({ done: true }),
      releaseLock: vi.fn(),
    };
    const mockFetch = createStreamMockFetch(mockReader);

    const messages: Message[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
    ];
    const options = { apiKey: "test-api-key", stream: true, mock: { fetch: mockFetch } };

    const generator = callAi(messages, options) as unknown as AsyncGenerator<string, string, unknown>;
    await generator.next();

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.messages).toEqual(messages);
  });

  it("should handle schema parameter correctly", async () => {
    const mockReader = {
      read: vi.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>().mockResolvedValueOnce({ done: true }),
      releaseLock: vi.fn(),
    };
    const mockFetch = createStreamMockFetch(mockReader);

    const schema: Schema = {
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name"],
    };

    const options = {
      apiKey: "test-api-key",
      stream: true,
      model: "openai/gpt-4o",
      schema: schema,
      mock: { fetch: mockFetch },
    };

    const generator = callAi("Get user info", options) as unknown as AsyncGenerator<string, string, unknown>;
    await generator.next();

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.required).toEqual(["name"]);
  });

  it("should handle schema parameter matching documentation example", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [
        {
          message: {
            content: '{"todos": ["Learn React basics", "Build a simple app", "Master hooks"]}',
          },
        },
      ],
    });

    const todoSchema: Schema = {
      properties: {
        todos: {
          type: "array",
          items: { type: "string" },
        },
      },
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: todoSchema,
      mock: { fetch: mockFetch },
    };

    await callAi("Give me a todo list for learning React", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.properties).toEqual(todoSchema.properties);
  });

  it("should handle aliens schema example", async () => {
    const mockReader = {
      read: vi.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>().mockResolvedValueOnce({ done: true }),
      releaseLock: vi.fn(),
    };
    const mockFetch = createStreamMockFetch(mockReader);

    const alienSchema = {
      properties: {
        aliens: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              traits: {
                type: "array",
                items: { type: "string" },
              },
              environment: { type: "string" },
            },
          },
        },
      },
    };

    const messages: Message[] = [
      {
        role: "user" as const,
        content: "Generate 3 unique alien species with unique biological traits, appearance, and preferred environments.",
      },
    ];

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      stream: true,
      schema: alienSchema,
      mock: { fetch: mockFetch },
    };

    const generator = callAi(messages, options) as unknown as AsyncGenerator<string, string, unknown>;
    await generator.next();

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema.properties.aliens.type).toBe("array");
    expect(body.response_format.json_schema.schema.properties.aliens.items.type).toBe("object");
    expect(body.response_format.json_schema.schema.properties.aliens.items.properties).toEqual(
      alienSchema.properties.aliens.items.properties,
    );
    expect(body.model).toBe("openai/gpt-4o");
    expect(body.stream).toBe(true);
  });

  it("should handle non-streaming response", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: "Hello, I am an AI" } }],
    });

    const options = {
      apiKey: "test-api-key",
      skipRetry: true,
      mock: { fetch: mockFetch },
    };

    const result = await callAi("Hello", options);

    expect(result).toBe("Hello, I am an AI");
  });

  it("should include schema name property when provided", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: '{"result": "Test successful"}' } }],
    });

    const schemaWithName: Schema = {
      name: "test_schema",
      properties: {
        result: { type: "string" },
      },
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schemaWithName,
      mock: { fetch: mockFetch },
    };

    await callAi("Test with schema name", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("test_schema");
  });

  it("should work correctly with schema without name property", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: '{"result": "Test successful"}' } }],
    });

    const schemaWithoutName: Schema = {
      properties: {
        result: { type: "string" },
      },
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schemaWithoutName,
      mock: { fetch: mockFetch },
    };

    await callAi("Test without schema name", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("result");
  });

  it('should use default name "result" when schema has no name property', async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: '{"data": "Some content"}' } }],
    });

    const schemaWithoutName: Schema = {
      properties: {
        data: { type: "string" },
      },
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schemaWithoutName,
      mock: { fetch: mockFetch },
    };

    await callAi("Generate content with schema", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("result");
  });

  it("should handle schema with empty properties", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: "{}" } }],
    });

    const emptySchema: Schema = {
      properties: {},
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: emptySchema,
      mock: { fetch: mockFetch },
    };

    await callAi("Test with empty schema", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("result");
    expect(body.response_format.json_schema.schema.properties).toEqual({});
    expect(body.response_format.json_schema.schema.required).toEqual([]);
  });

  it("should respect additionalProperties setting in schema", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [
        {
          message: {
            content: '{"result": "Test successful", "extra": "Additional field"}',
          },
        },
      ],
    });

    const schema: Schema = {
      properties: {
        result: { type: "string" },
      },
      additionalProperties: true,
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schema,
      mock: { fetch: mockFetch },
    };

    await callAi("Test with additionalProperties", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(true);
  });

  it("should handle errors during API call for non-streaming", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    try {
      const options = { apiKey: "test-api-key", mock: { fetch: mockFetch } };
      await callAi("Hello", options);
      fail("Expected an error to be thrown");
    } catch (error) {
      expect((error as Error).message).toContain("Network error");
    }
  });

  it("should handle errors during API call for streaming", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    try {
      const options = { apiKey: "test-api-key", stream: true, mock: { fetch: mockFetch } };
      await callAi("Hello", options);
      fail("Expected an error to be thrown");
    } catch (error) {
      expect((error as Error).message).toContain("Network error");
    }
  });

  it("should default to streaming mode (false) if not specified", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [{ message: { content: "Hello, I am an AI" } }],
    });

    const options = { apiKey: "test-api-key", mock: { fetch: mockFetch } };

    await callAi("Hello", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.stream).toBe(false);
  });

  it("should include schema property in json_schema", async () => {
    const mockFetch = createJsonMockFetch({
      choices: [
        {
          message: {
            content: '{"title":"Healthy Living","description":"A playlist to inspire a healthy lifestyle"}',
          },
        },
      ],
    });

    const schema: Schema = {
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        songs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              artist: { type: "string" },
              year: { type: "string" },
              comment: { type: "string" },
            },
          },
        },
      },
      required: ["title", "description", "songs"],
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schema,
      mock: { fetch: mockFetch },
    };

    await callAi("Create a themed music playlist", options);

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.schema).toBeDefined();

    const schemaProperties = body.response_format.json_schema.schema.properties;
    expect(schemaProperties.title.type).toBe("string");
    expect(schemaProperties.description.type).toBe("string");
    expect(schemaProperties.songs.type).toBe("array");
    expect(schemaProperties.songs.items.type).toBe("object");
    expect(schemaProperties.songs.items.properties.title.type).toBe("string");
    expect(schemaProperties.songs.items.properties.artist.type).toBe("string");
    expect(schemaProperties.songs.items.properties.year.type).toBe("string");
    expect(schemaProperties.songs.items.properties.comment.type).toBe("string");

    expect(body.response_format.json_schema.schema.required).toEqual(schema.required);
  });

  it("should handle streaming with schema for structured output", async () => {
    const mockReader = {
      read: vi
        .fn<() => Promise<{ done: boolean; value?: Uint8Array }>>()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`data: {"choices":[{"delta":{"content":"{\\"temp"}}]}\n\n`),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`data: {"choices":[{"delta":{"content":"erature\\": 22, \\"cond"}}]}\n\n`),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(`data: {"choices":[{"delta":{"content":"itions\\": \\"Sunny\\"}"}}]}\n\n`),
        })
        .mockResolvedValueOnce({
          done: true,
        }),
      releaseLock: vi.fn(),
    };

    const mockFetch = createStreamMockFetch(mockReader);

    const schema: Schema = {
      name: "weather",
      properties: {
        temperature: { type: "number" },
        conditions: { type: "string" },
      },
    };

    const options = {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      stream: true,
      schema: schema,
      mock: { fetch: mockFetch },
    };

    const generator = callAi("What is the weather?", options) as unknown as AsyncGenerator<string, string, unknown>;

    let finalValue = "";
    let result = await generator.next();
    while (!result.done) {
      finalValue = result.value as string;
      result = await generator.next();
    }

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.name).toBe("weather");
    expect(body.stream).toBe(true);

    expect(finalValue).toContain("temperature");
    expect(finalValue).toContain("22");
    expect(finalValue).toContain("conditions");
    expect(finalValue).toContain("Sunny");
  });
});
