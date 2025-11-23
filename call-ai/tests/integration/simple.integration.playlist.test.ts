import { callAi, getMeta, Message } from "call-ai";
import { dotenv } from "zx";
import { describe, expect, it } from "vitest";

// Load environment variables from .env file if present
dotenv.config();

// Configure retry settings for flaky tests - use fewer retries with faster failures
// jest.retryTimes(2, { logErrorsBeforeRetry: true });

// Increase Jest's default timeout to handle all parallel requests
// jest.setTimeout(60000);

// Skip tests if no API key is available
const haveApiKey = process.env.CALLAI_API_KEY;
// const itif = (condition: boolean) => (condition ? it.concurrent : it.skip);

// Timeout for individual test
const TIMEOUT = 30000;

// Test models based on the OpenRouter documentation
const supportedModels = {
  openAI: { id: "openai/gpt-4o-mini", grade: "A" },
  gemini: { id: "google/gemini-2.5-flash", grade: "A" },
  // geminiPro: { id: "google/gemini-2.5-pro-preview-03-25", grade: "A" },
  // claude: { id: "anthropic/claude-3-sonnet", grade: "A" },
  // claudeThinking: { id: "anthropic/claude-3.7-sonnet:thinking", grade: "B" },
  // llama3: { id: "meta-llama/llama-4-maverick", grade: "B" },
  // deepseek: { id: 'deepseek/deepseek-chat', grade: 'C' },
  // gpt4turbo: { id: "openai/gpt-4-turbo", grade: "B" },
};

// Define the model names as an array for looping
const modelEntries = Object.entries(supportedModels);

// Function to handle test expectations based on model grade
const expectOrWarn = (model: { id: string; grade: string }, condition: boolean, message: string) => {
  if (model.grade === "A") {
    expect(condition).toBe(true);
  } else if (!condition) {
    console.warn(`Warning (${model.id}): ${message}`);
  }
};

// Create a test function that won't fail on timeouts for B and C grade models
const gradeAwareTest = (modelId: { id: string; grade: string }) => {
  if (!haveApiKey) return it.skip;

  if (modelId.grade === "A") {
    return it.concurrent;
  } else {
    // For B and C models, use a test wrapper that won't fail on timeouts
    return (name: string, fn: () => Promise<void>, timeout?: number) => {
      return it.concurrent(
        name,
        async () => {
          try {
            // Set a short timeout for the Promise.race to keep tests running quickly
            const result = await Promise.race([
              fn(),
              new Promise((resolve) =>
                setTimeout(() => {
                  console.warn(`Timeout for ${modelId.id} (Grade ${modelId.grade}): ${name}`);
                  resolve(undefined);
                }, timeout || TIMEOUT),
              ),
            ]);
            return result;
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn(`Error in ${modelId.id} (Grade ${modelId.grade}): ${errorMessage}`);
            // Don't fail the test
            return;
          }
        },
        timeout,
      );
    };
  }
};

describe("Simple callAi integration tests", () => {
  // Test basic non-structured requests with all models
  describe("Non-structured text generation", () => {
    // Run all model tests concurrently within this describe block

    // Test with a music playlist schema
    modelEntries.map(([modelName, modelId]) => {
      gradeAwareTest(modelId)(
        `should create playlist with ${modelName} model using schema`,
        async () => {
          // Make API call with the music schema
          const result = await callAi(
            [
              {
                role: "user" as const,
                content: "Create a themed playlist for a relaxing evening with 3-5 songs.",
              },
            ] as Message[],
            {
              apiKey: process.env.CALLAI_API_KEY,
              model: modelId.id,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  theme: { type: "string" },
                  mood: { type: "string" },
                  songs: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        artist: { type: "string" },
                        year: { type: "string" },
                        genre: { type: "string" },
                      },
                      required: ["title", "artist", "year", "genre"],
                    },
                  },
                },
                required: ["title", "theme", "mood", "songs"],
              },
            },
          );

          // Get the metadata
          const resultMeta = getMeta(result);

          // Verify response
          expectOrWarn(modelId, typeof result === "string", `Result is not a string but ${typeof result} in ${modelName} model`);

          // Log raw response information

          // Verify metadata
          expectOrWarn(modelId, !!resultMeta, `Metadata should be defined for ${modelName} model`);
          if (resultMeta) {
            expectOrWarn(modelId, !!resultMeta.model, `Model should be defined in metadata for ${modelName}`);
            expectOrWarn(modelId, !!resultMeta.timing, `Timing should be defined in metadata for ${modelName}`);
            expectOrWarn(modelId, !!resultMeta.timing?.startTime, `Start time should be defined in metadata for ${modelName}`);
            expectOrWarn(modelId, !!resultMeta.timing?.endTime, `End time should be defined in metadata for ${modelName}`);
            expectOrWarn(modelId, !!resultMeta.rawResponse, `Raw response should be defined in metadata for ${modelName}`);
          }

          if (typeof result === "string") {
            try {
              const data = JSON.parse(result);
              expectOrWarn(
                modelId,
                typeof data === "object" && data !== null,
                `Parsed result is not an object in ${modelName} model response`,
              );

              if (typeof data === "object" && data !== null) {
                // Check required fields
                expectOrWarn(modelId, "title" in data, `Missing 'title' in ${modelName} model response`);
                expectOrWarn(modelId, "theme" in data, `Missing 'theme' in ${modelName} model response`);
                expectOrWarn(modelId, "songs" in data, `Missing 'songs' in ${modelName} model response`);

                // Check title and theme
                if ("title" in data) {
                  expectOrWarn(modelId, typeof data.title === "string", `'title' is not a string in ${modelName} model response`);
                }

                if ("theme" in data) {
                  expectOrWarn(modelId, typeof data.theme === "string", `'theme' is not a string in ${modelName} model response`);
                }

                // Check songs array
                if ("songs" in data) {
                  expectOrWarn(modelId, Array.isArray(data.songs), `'songs' is not an array in ${modelName} model response`);

                  if (Array.isArray(data.songs)) {
                    expectOrWarn(
                      modelId,
                      data.songs.length >= 3 && data.songs.length <= 5,
                      `Songs count (${data.songs.length}) out of range (3-5) in ${modelName} model response`,
                    );

                    // Check first song
                    if (data.songs.length > 0) {
                      const firstSong = data.songs[0];
                      expectOrWarn(
                        modelId,
                        typeof firstSong === "object" && firstSong !== null,
                        `First song is not an object in ${modelName} model response`,
                      );

                      if (typeof firstSong === "object" && firstSong !== null) {
                        // Check required properties
                        expectOrWarn(modelId, "title" in firstSong, `Missing 'title' in first song in ${modelName} model response`);
                        expectOrWarn(
                          modelId,
                          "artist" in firstSong,
                          `Missing 'artist' in first song in ${modelName} model response`,
                        );

                        // Check types
                        if ("title" in firstSong) {
                          expectOrWarn(
                            modelId,
                            typeof firstSong.title === "string",
                            `Song title is not a string in ${modelName} model response`,
                          );
                        }

                        if ("artist" in firstSong) {
                          expectOrWarn(
                            modelId,
                            typeof firstSong.artist === "string",
                            `Song artist is not a string in ${modelName} model response`,
                          );
                        }
                      }
                    }
                  }
                }
              }
            } catch (e) {
              expectOrWarn(modelId, false, `JSON parse error in ${modelName} model response: ${e}`);
            }
          }
        },
        TIMEOUT,
      );
    });
  });
});
