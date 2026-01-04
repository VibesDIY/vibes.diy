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
  geminiPro: { id: "google/gemini-2.5-pro", grade: "A" },
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
    modelEntries.map(([modelName, modelId]) => {
      // Test with a system prompt
      gradeAwareTest(modelId)(
        `should handle system prompt with ${modelName} model`,
        async () => {
          // Create message array with system prompt
          const messages = [
            {
              role: "system" as const,
              content: "You are a helpful assistant that provides only factual information.",
            },
            {
              role: "user" as const,
              content: "Provide information about France.",
            },
          ] as Message[];

          // Make API call with message array
          const result = await callAi(messages, {
            apiKey: process.env.CALLAI_API_KEY,
            model: modelId.id,
          });

          // Get the metadata
          const resultMeta = getMeta(result as string);

          // Verify response
          expectOrWarn(modelId, typeof result === "string", `Result is not a string but a ${typeof result} in ${modelName} model`);
          if (typeof result === "string") {
            expectOrWarn(modelId, result.length > 50, `Result length (${result.length}) too short in ${modelName} model`);
            // Should mention France somewhere in the response
            expectOrWarn(
              modelId,
              result.toLowerCase().includes("france"),
              `Response doesn't mention "France" in ${modelName} model`,
            );
          }

          // Verify metadata
          expect(resultMeta).toBeDefined();
          expect(resultMeta?.model).toContain(modelId.id.split("/").pop());
          expect(resultMeta?.timing).toBeDefined();
          expect(resultMeta?.timing?.startTime).toBeDefined();
          // Check for metadata - all models should have raw response data
          expect(resultMeta?.rawResponse).toBeDefined();
        },
        TIMEOUT,
      );
    });
  });
});
