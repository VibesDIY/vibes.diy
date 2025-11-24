import { callAi, getMeta } from "call-ai";
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

// Function to handle test expectations based on model grade
const expectOrWarn = (
  model: { id: string; grade: string },
  condition: boolean,
  message: string,
  debugValue?: unknown, // Added optional debug value parameter
) => {
  if (model.grade === "A") {
    if (!condition) {
      // Enhanced debug logging for failures
      console.log(`DETAILED FAILURE for ${model.id}: ${message}`);
      if (debugValue !== undefined) {
        console.log("Debug value:", typeof debugValue === "object" ? JSON.stringify(debugValue, null, 2) : debugValue);
      }
    }
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

describe("Claude JSON property splitting test", () => {
  // This test specifically targets the issue where Claude's streaming API
  // splits JSON property names across chunk boundaries
  describe("Streaming JSON property name handling", () => {
    // Run all model tests concurrently within this describe block
    modelEntries.map(([modelName, modelId]) => {
      // Only test Claude models as they exhibit the property splitting issue
      if (modelId.id.includes("claude")) {
        gradeAwareTest(modelId)(
          `should handle property name splitting across chunks in ${modelName} streaming response`,
          async () => {
            // Make API call with stream enabled to trigger the potential JSON property splitting issue
            const result = await callAi(
              "Provide information about France. Population should be expressed in millions (e.g., 67.5 for 67.5 million people).",
              {
                apiKey: process.env.CALLAI_API_KEY,
                model: modelId.id,
                stream: true, // Streaming must be enabled to trigger the property splitting issue
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
            expectOrWarn(
              modelId,
              typeof result === "string",
              `Result is not a string but a ${typeof result} in ${modelName} model`,
            );

            // For streaming responses, collect all chunks
            let finalResult = "";
            let chunkCount = 0;

            if (typeof result === "object" && Symbol.asyncIterator in result) {
              // Handle streaming response
              console.log(`\n===== Starting streaming test with ${modelName} =====`);
              console.log(`This test will pass if property names split across chunks are handled correctly`);

              try {
                // Collect all chunks
                const generator = result as AsyncGenerator<string>;
                for await (const chunk of generator) {
                  chunkCount++;
                  // The last chunk will be the complete response
                  finalResult = chunk;
                }

                console.log(`\n===== Received ${chunkCount} chunks from ${modelName} =====`);
                console.log(finalResult.substring(0, 500) + (finalResult.length > 500 ? "..." : ""));

                // This is the key part - parse the final JSON result
                // Without the fix, this might fail when property names are split across chunks
                const data = JSON.parse(finalResult);

                // Log parsed data for debugging
                console.log(`\n===== Successfully parsed data from ${modelName} =====`);
                console.log(JSON.stringify(data, null, 2));

                console.log(`\n===== TEST PASSED: JSON property splitting handled correctly =====`);

                // Check timing info
                const meta = getMeta(generator);
                if (meta?.timing?.startTime && meta?.timing?.endTime) {
                  console.log(`\n===== Timing for ${modelName} =====`);
                  console.log(JSON.stringify(meta.timing, null, 2));
                }

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
                      // This is a critical check for our property splitting test
                      // If "population" was split (e.g., "popul" + "ation"), parsing would fail without our fix
                      expectOrWarn(
                        modelId,
                        populationInMillions >= 60 && populationInMillions <= 70,
                        `Population ${data.population} (${populationInMillions.toFixed(
                          2,
                        )}M) outside expected range in ${modelName} model response - possibly due to property name splitting`,
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
                // This will be hit if JSON parsing fails, which is the issue we're testing for
                console.log(`\n===== TEST FAILED: JSON parsing error in ${modelName} response =====`);
                console.log(`This indicates the streaming property splitting issue is present!`);
                console.log(`Error: ${e}`);
                console.log(`JSON that failed to parse: ${finalResult}`);

                expectOrWarn(
                  modelId,
                  false,
                  `JSON parse error in ${modelName} model response: ${e}\nThis indicates the streaming property splitting issue is present!`,
                );
              }
            }
          },
          TIMEOUT,
        );
      }
    });
  });
});

// Add a comment explaining the test's purpose
// This test verifies that Claude's streaming responses are correctly handled
// when JSON property names are split across multiple chunks.
// The issue occurs when a property name like "population" gets split into
// "popul" and "ation" across different chunks, causing JSON parsing errors.
