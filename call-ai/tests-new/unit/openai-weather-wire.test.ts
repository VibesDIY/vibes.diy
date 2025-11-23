import { callAi, Schema } from "call-ai";
import { beforeEach, describe, expect, it, vitest } from "vitest";

// Mock fetch to use our fixture files
const mock = { fetch: vitest.fn() };

describe("OpenAI Weather Streaming Tests", () => {
  // Read fixtures
  // const weatherRequestFixture = JSON.parse(
  //   fs.readFileSync(
  //     path.join(__dirname, "fixtures/openai-weather-request.json"),
  //     "utf8",
  //   ),
  // );

  // const weatherResponseFixture = fs.readFileSync(path.join(__dirname, "../fixtures/openai-weather-response.json"), "utf8");

  function weatherResponseFixture() {
    return fetch("http://localhost:15731/fixtures/openai-weather-response.txt")
      .then(async (r) => {
        const text = await r.text();
        return text;
      })
      .catch((e) => {
        console.error("Error fetching OpenAI weather response:", e);
        throw e;
      });
  }

  beforeEach(() => {
    // Reset mocks
    mock.fetch.mockClear();

    // Mock successful response for streaming request
    mock.fetch.mockImplementation(async (_url, options) => {
      const requestBody = JSON.parse(options.body as string);

      if (requestBody.stream) {
        const responseText = await weatherResponseFixture();
        // Mock streaming response with our weather fixtures
        return {
          ok: true,
          status: 200,
          body: {
            getReader: () => {
              // Stream reader that returns chunks from our fixture
              const chunks = responseText
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
          text: async () => weatherResponseFixture(),
          json: async () => JSON.parse(await weatherResponseFixture()),
        };
      } else {
        throw new Error("Non-streaming request not expected in this test");
      }
    });
  });

  it("should correctly handle OpenAI streaming with weather schema", async () => {
    // Define the weather schema
    const schema: Schema = {
      name: "weather_forecast",
      properties: {
        location: { type: "string" },
        current_temp: { type: "number" },
        conditions: { type: "string" },
        tomorrow: {
          type: "object",
          properties: {
            high: { type: "number" },
            low: { type: "number" },
            conditions: { type: "string" },
          },
        },
      },
    };

    // Call the library with OpenAI model and streaming
    const generator = (await callAi("Give me a weather forecast for New York in the requested format.", {
      apiKey: "test-api-key",
      model: "openai/gpt-4o",
      schema: schema,
      stream: true,
      mock,
    })) as AsyncGenerator<string, string, unknown>;

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
    const data = JSON.parse(lastChunk);

    // Verify the weather data structure
    expect(data).toHaveProperty("location");
    expect(data).toHaveProperty("current_temp");
    expect(data).toHaveProperty("conditions");
    expect(data).toHaveProperty("tomorrow");

    // Verify types
    expect(typeof data.location).toBe("string");
    expect(typeof data.current_temp).toBe("number");
    expect(typeof data.conditions).toBe("string");
    expect(typeof data.tomorrow).toBe("object");
    expect(typeof data.tomorrow.conditions).toBe("string");
  });
});
