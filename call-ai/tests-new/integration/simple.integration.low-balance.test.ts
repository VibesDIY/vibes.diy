import { callAi, callAiEnv } from "call-ai";
import { describe, it, expect, assert } from "vitest";

// Skip tests if no API key is available
// const haveApiKey = callAiEnv.LOW_BALANCE_OPENROUTER_API_KEY;

// // Copy LOW_BALANCE_OPENROUTER_API_KEY to CALLAI_API_KEY for this test
// if (callAiEnv.LOW_BALANCE_OPENROUTER_API_KEY) {
//   callAiEnv.CALLAI_API_KEY = callAiEnv.LOW_BALANCE_OPENROUTER_API_KEY;
// }

// Test models based on the OpenRouter documentation
const supportedModels = {
  claude: { id: "anthropic/claude-3-sonnet", grade: "A" },
};

// Define the model names as an array for looping
const modelEntries = Object.entries(supportedModels);

describe("Low Balance API Key Tests", () => {
  // Skip the entire test suite if no low balance API key is available

  modelEntries.forEach(([modelName, modelInfo]) => {
    it(`should verify key limit exceeded error occurs with ${modelName} model`, async () => {
      try {
        // Make API call with skipRefresh flag to ensure we get the low balance error
        await callAi("Provide information about France.", {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: modelInfo.id,
          max_tokens: 200000 - 200,
          // When implemented, this will skip the automatic key refresh
          skipRefresh: true,
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
        });

        // If we get here, the key wasn't actually low balance - test should fail
        assert.fail("Expected key limit exceeded error but got successful result");
      } catch (error) {
        // We expect a 403 error with "Key limit exceeded" message
        const errorStr = String(error);

        // Test passes when we get the key limit exceeded error
        expect(errorStr).toContain("403");
        expect(errorStr).toContain("Key limit exceeded");

        // Log the error for visibility
      }
    });
  });
});
