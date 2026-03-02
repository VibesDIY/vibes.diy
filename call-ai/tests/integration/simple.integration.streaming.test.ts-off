import { callAi } from "call-ai";
// import { Message } from "../src/types";
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
  geminiPro: { id: "google/gemini-2.5-pro", grade: "A" },
  claude: { id: "anthropic/claude-3-sonnet", grade: "A" },
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
                }, timeout || TIMEOUT)
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
        timeout
      );
    };
  }
};

describe("Simple callAi integration tests", () => {
  // Test basic non-structured requests with all models
  describe("Non-structured text generation", () => {
    // Run all model tests concurrently within this describe block
    modelEntries.map(([modelName, modelId]) => {
      // Test with streaming
      gradeAwareTest(modelId)(
        `should generate text with ${modelName} model with streaming`,
        async () => {
          // Make a simple non-structured API call with streaming
          const generator = await callAi("Write a short joke about programming.", {
            apiKey: process.env.CALLAI_API_KEY,
            model: modelId.id,
            stream: true,
          });

          // Get the metadata for the streaming response
          // const resultMeta = getMeta(generator);

          // Stream should be an AsyncGenerator
          expectOrWarn(
            modelId,
            typeof generator === "object",
            `Generator is not an object but a ${typeof generator} in ${modelName} model`
          );

          // Manual type assertion to help TypeScript recognize generator as AsyncGenerator
          if (typeof generator === "object" && generator !== null) {
            const asyncGenerator = generator as AsyncGenerator<string, string, unknown>;

            // Collect all chunks
            let finalResult = "";
            try {
              for await (const chunk of asyncGenerator) {
                // Each chunk should be a string
                expectOrWarn(
                  modelId,
                  typeof chunk === "string",
                  `Chunk is not a string but a ${typeof chunk} in ${modelName} model`
                );
                finalResult = chunk;
              }

              // Final result should be a meaningful string
              expectOrWarn(
                modelId,
                finalResult.length > 10,
                `Final result too short (${finalResult.length} chars) in ${modelName} model`
              );
            } catch (error) {
              // Log error but don't fail test for B/C grade models
              const errorMessage = error instanceof Error ? error.message : String(error);
              expectOrWarn(modelId, false, `Streaming error in ${modelName} model: ${errorMessage}`);
            }
          }
        },
        TIMEOUT
      );
    });
  });
});
