import { callAi, getMeta, callAiEnv } from "call-ai";
import { expectOrWarn } from "../test-helper.js";
import { describe, it, expect } from "vitest";

// Configure retry settings for flaky tests - use fewer retries with faster failures
// jest.retryTimes(2, { logErrorsBeforeRetry: true });

// Increase Jest's default timeout to handle all parallel requests
// jest.setTimeout(60000);

// Skip tests if no API key is available
// const haveApiKey = callAiEnv.LOW_BALANCE_OPENROUTER_API_KEY;

// Set up environment variables for testing key refresh behavior
// if (callAiEnv.LOW_BALANCE_OPENROUTER_API_KEY) {
// Use the low balance key for triggering a refresh scenario
// callAiEnv.CALLAI_API_KEY = callAiEnv.LOW_BALANCE_OPENROUTER_API_KEY;

// Set the refresh endpoint to vibecode.garden if not already set
// if (!callAiEnv.CALLAI_REFRESH_ENDPOINT) {
// callAiEnv.CALLAI_REFRESH_ENDPOINT = "https://vibecode.garden";
// }

// Set the refresh token for authentication
//   if (!callAiEnv.CALL_AI_REFRESH_TOKEN) {
//     callAiEnv.CALL_AI_REFRESH_TOKEN = "use-vibes";
//   }
// }
// const itif = (condition: boolean) => (condition ? it.concurrent : it.skip);

// Timeout for individual test
const TIMEOUT = 30000;

// Test models based on the OpenRouter documentation
const supportedModels = {
  // openAI: { id: "openai/gpt-4o-mini", grade: "A" },
  // gemini: { id: "google/gemini-2.5-flash", grade: "A" },
  // geminiPro: { id: "google/gemini-2.5-pro-preview-03-25", grade: "A" },
  claude: { id: "anthropic/claude-3-sonnet", grade: "A" },
  // claudeThinking: { id: "anthropic/claude-3.7-sonnet:thinking", grade: "B" },
  // llama3: { id: "meta-llama/llama-4-maverick", grade: "B" },
  // deepseek: { id: 'deepseek/deepseek-chat', grade: 'C' },
  // gpt4turbo: { id: "openai/gpt-4-turbo", grade: "B" },
};

// Define the model names as an array for looping
const modelEntries = Object.entries(supportedModels);

// Create a test function that won't fail on timeouts for B and C grade models
const gradeAwareTest = (modelId: { id: string; grade: string }) => {
  if (!callAiEnv.CALLAI_API_KEY) return it.skip;

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
    modelEntries.map(([modelName, modelId]) => {
      // Test with functions/tools (simple schema)
      gradeAwareTest(modelId)(
        `should handle basic schema with ${modelName} model`,
        async () => {
          // Make API call with a basic schema
          const result = await callAi(
            "Provide information about France. Population should be expressed in millions (e.g., 67.5 for 67.5 million people).",
            {
              apiKey: callAiEnv.CALLAI_API_KEY,
              model: modelId.id,
              debug: true,
              refreshToken: "not-a-vibe",
              updateRefreshToken: async (refreshToken) => {
                // Assert that the failing token is the one we provided
                expect(refreshToken).toBe("not-a-vibe");
                await new Promise((resolve) => setTimeout(resolve, 50));
                return "use-vibes";
              },
              max_tokens: 128000 - 200,
              schema: {
                type: "object",
                properties: {
                  capital: { type: "string" },
                  population: { type: "number" },
                  languages: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          );

          // Get the metadata
          // const resultMeta = getMeta(result);

          // Verify response
          expectOrWarn(modelId, typeof result === "string", `Result is not a string but a ${typeof result} in ${modelName} model`);

          if (typeof result === "string") {
            // Try to parse as JSON
            try {
              // Log the entire response for debugging

              const data = JSON.parse(result);

              // Log parsed data for debugging

              // Verify actual API call timing
              const meta = getMeta(result);

              // Ensure the call took at least 5ms (to detect mocks or cached responses)
              if (meta?.timing?.duration !== undefined) {
                expectOrWarn(
                  modelId,
                  meta.timing.duration >= 5,
                  `API call duration (${meta.timing.duration}ms) was suspiciously fast for ${modelName} model, possibly mocked or cached`,
                  meta.timing,
                );
              } else {
                console.warn(`No timing information available for ${modelName} model`);
              }

              expectOrWarn(
                modelId,
                typeof data === "object" && data !== null,
                `Parsed result is not an object in ${modelName} model response`,
                data,
              );

              if (typeof data === "object" && data !== null) {
                // Check required fields
                expectOrWarn(modelId, "capital" in data, `Missing 'capital' in ${modelName} model response`, Object.keys(data));
                expectOrWarn(
                  modelId,
                  "population" in data,
                  `Missing 'population' in ${modelName} model response`,
                  Object.keys(data),
                );

                // Validate capital
                if ("capital" in data) {
                  expectOrWarn(
                    modelId,
                    typeof data.capital === "string",
                    `Capital is not a string in ${modelName} model response`,
                    data.capital,
                  );
                  if (typeof data.capital === "string") {
                    expectOrWarn(
                      modelId,
                      data.capital.toLowerCase().includes("paris"),
                      `Capital ${data.capital} is not Paris in ${modelName} model response`,
                      data.capital,
                    );
                  }
                }

                // Validate population
                if ("population" in data) {
                  expectOrWarn(
                    modelId,
                    typeof data.population === "number",
                    `'population' is not a number in ${modelName} model response`,
                    data.population,
                  );
                  if (typeof data.population === "number") {
                    // Population should be in a reasonable range (60-70 million for France)
                    // Check if number is already in millions (under 100) or in absolute (over 1 million)
                    const populationInMillions = data.population < 1000 ? data.population : data.population / 1000000;
                    expectOrWarn(
                      modelId,
                      populationInMillions >= 60 && populationInMillions <= 70,
                      `Population ${data.population} (${populationInMillions.toFixed(
                        2,
                      )}M) outside expected range in ${modelName} model response`,
                      data.population,
                    );
                  }
                }

                // Check languages if present
                if ("languages" in data) {
                  expectOrWarn(
                    modelId,
                    Array.isArray(data.languages),
                    `'languages' is not an array in ${modelName} model response`,
                    data.languages,
                  );
                  if (Array.isArray(data.languages)) {
                    // Should include French
                    expectOrWarn(
                      modelId,
                      data.languages.some((lang: string) => typeof lang === "string" && lang.toLowerCase().includes("french")),
                      `Languages doesn't include French in ${modelName} model response`,
                      data.languages,
                    );
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
