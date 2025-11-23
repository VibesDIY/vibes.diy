import { callAi, getMeta, callAiEnv } from "call-ai";
import { expectOrWarn } from "../test-helper.js";
import { describe, it } from "vitest";

// import { Message } from "../src/types";

// Configure retry settings for flaky tests - use fewer retries with faster failures
// jest.retryTimes(2, { logErrorsBeforeRetry: true });

// Increase Jest's default timeout to handle all parallel requests
// jest.setTimeout(60000);

// const itif = (condition: boolean) => (condition ? it.concurrent : it.skip);

// Timeout for individual test
const TIMEOUT = 30000;

// Test models based on the OpenRouter documentation
const supportedModels = {
  //x openAI: { id: "openai/gpt-4o-mini", grade: "A" },
  //x gemini: { id: "google/gemini-2.5-flash", grade: "A" },

  // geminiPro: { id: "google/gemini-2.5-pro", grade: "A" },
  claude: { id: "anthropic/claude-3-sonnet", grade: "A" },
  // claudeThinking: { id: "anthropic/claude-3.7-sonnet:thinking", grade: "B" },
  // llama3: { id: "meta-llama/llama-4-maverick", grade: "B" },
  // deepseek: { id: 'deepseek/deepseek-chat', grade: 'C' },
  // gpt4turbo: { id: "openai/gpt-4-turbo", grade: "B" },
};

// Define the model names as an array for looping
const modelEntries = Object.entries(supportedModels);

// Create a test function that won't fail on timeouts for B and C grade models
// const gradeAwareTest = (modelId: { id: string; grade: string }) => {

//   if (modelId.grade === "A") {
//     return it.concurrent;
//   } else {
//     // For B and C models, use a test wrapper that won't fail on timeouts
//     return (name: string, fn: () => Promise<void>, timeout?: number) => {
//       return it.concurrent(
//         name,
//         async () => {
//           try {
//             // Set a short timeout for the Promise.race to keep tests running quickly
//             const result = await Promise.race([
//               fn(),
//               new Promise((resolve) =>
//                 setTimeout(() => {
//                   console.warn(`Timeout for ${modelId.id} (Grade ${modelId.grade}): ${name}`);
//                   resolve(undefined);
//                 }, timeout || TIMEOUT),
//               ),
//             ]);
//             return result;
//           } catch (error: unknown) {
//             const errorMessage = error instanceof Error ? error.message : String(error);
//             console.warn(`Error in ${modelId.id} (Grade ${modelId.grade}): ${errorMessage}`);
//             // Don't fail the test
//             return;
//           }
//         },
//         timeout,
//       );
//     };
//   }
// };

describe("Simple callAi integration tests", () => {
  // Test basic non-structured requests with all models
  describe.each(modelEntries)("Non-structured text generation", (modelName, modelId) => {
    // Run all model tests concurrently within this describe block
    it(
      `should generate recipe with ${modelName} model using schema`,
      async () => {
        // Make API call with a recipe schema
        const result = await callAi("Create a recipe for a healthy dinner.", {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: modelId.id,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              ingredients: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    amount: { type: "string" },
                  },
                  required: ["name", "amount"],
                },
              },
              steps: {
                type: "array",
                items: { type: "string" },
              },
              prep_time_minutes: { type: "number" },
              cook_time_minutes: { type: "number" },
              servings: { type: "number" },
            },
            required: ["title", "description", "ingredients", "steps", "prep_time_minutes", "cook_time_minutes", "servings"],
          },
        });

        // Get the metadata
        const resultMeta = getMeta(result);

        // Verify response
        expectOrWarn(modelId, typeof result === "string", `Result is not a string but ${typeof result} in ${modelName} model`);

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
              const requiredFields = [
                "title",
                "description",
                "ingredients",
                "steps",
                "prep_time_minutes",
                "cook_time_minutes",
                "servings",
              ];

              for (const field of requiredFields) {
                expectOrWarn(modelId, field in data, `Missing '${field}' in ${modelName} model response`);
              }

              // Validate types and some basic content
              if ("title" in data) {
                expectOrWarn(modelId, typeof data.title === "string", `'title' is not a string in ${modelName} model response`);
                if (typeof data.title === "string") {
                  expectOrWarn(modelId, data.title.length > 3, `Title too short in ${modelName} model response`);
                }
              }

              if ("description" in data) {
                expectOrWarn(
                  modelId,
                  typeof data.description === "string",
                  `'description' is not a string in ${modelName} model response`,
                );
                if (typeof data.description === "string") {
                  expectOrWarn(modelId, data.description.length > 10, `Description too short in ${modelName} model response`);
                }
              }

              if ("ingredients" in data) {
                expectOrWarn(
                  modelId,
                  Array.isArray(data.ingredients),
                  `'ingredients' is not an array in ${modelName} model response`,
                );
                if (Array.isArray(data.ingredients)) {
                  expectOrWarn(modelId, data.ingredients.length > 0, `No ingredients in ${modelName} model response`);

                  // Check first ingredient
                  if (data.ingredients.length > 0) {
                    const firstIngredient = data.ingredients[0];
                    expectOrWarn(
                      modelId,
                      typeof firstIngredient === "object" && firstIngredient !== null,
                      `First ingredient is not an object in ${modelName} model response`,
                    );

                    if (typeof firstIngredient === "object" && firstIngredient !== null) {
                      expectOrWarn(
                        modelId,
                        "name" in firstIngredient,
                        `Missing 'name' in first ingredient in ${modelName} model response`,
                      );
                      expectOrWarn(
                        modelId,
                        "amount" in firstIngredient,
                        `Missing 'amount' in first ingredient in ${modelName} model response`,
                      );

                      if ("name" in firstIngredient) {
                        expectOrWarn(
                          modelId,
                          typeof firstIngredient.name === "string",
                          `Ingredient name is not a string in ${modelName} model response`,
                        );
                      }

                      if ("amount" in firstIngredient) {
                        expectOrWarn(
                          modelId,
                          typeof firstIngredient.amount === "string",
                          `Ingredient amount is not a string in ${modelName} model response`,
                        );
                      }
                    }
                  }
                }
              }

              if ("steps" in data) {
                expectOrWarn(modelId, Array.isArray(data.steps), `'steps' is not an array in ${modelName} model response`);
                if (Array.isArray(data.steps)) {
                  expectOrWarn(modelId, data.steps.length > 0, `No steps in ${modelName} model response`);

                  // Check first step
                  if (data.steps.length > 0) {
                    expectOrWarn(
                      modelId,
                      typeof data.steps[0] === "string",
                      `First step is not a string in ${modelName} model response`,
                    );
                  }
                }
              }

              // Check numeric fields
              const numericFields = ["prep_time_minutes", "cook_time_minutes", "servings"];
              for (const field of numericFields) {
                if (field in data) {
                  expectOrWarn(
                    modelId,
                    typeof data[field] === "number",
                    `'${field}' is not a number in ${modelName} model response`,
                  );
                  if (typeof data[field] === "number") {
                    expectOrWarn(modelId, data[field] > 0, `'${field}' is not positive in ${modelName} model response`);
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
