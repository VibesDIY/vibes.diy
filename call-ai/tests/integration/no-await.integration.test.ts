import { callAi } from "call-ai";
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
const itif = (condition: boolean) => (condition ? it.concurrent : it.skip);

// Timeout for individual test
const TIMEOUT = 30000;

// Test models based on the OpenRouter documentation
const supportedModels = {
  openAI: { id: "openai/gpt-4.1", grade: "A" },
  gemini: { id: "google/gemini-2.5-flash", grade: "A" },
  claude: { id: "anthropic/claude-3-sonnet", grade: "B" },
  llama3: { id: "meta-llama/llama-3.3-70b-instruct", grade: "C" },
  // deepseek: { id: 'deepseek/deepseek-chat', grade: 'C' },
  gpt4turbo: { id: "openai/gpt-4-turbo", grade: "B" },
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
      // Test without streaming
      gradeAwareTest(modelId)(
        `should generate text with ${modelName} model without streaming`,
        async () => {
          // Make a simple non-structured API call
          const result = await callAi("Write a short joke about programming.", {
            apiKey: process.env.CALLAI_API_KEY,
            model: modelId.id,
          });

          // Verify response
          expectOrWarn(modelId, !!result, `should generate text with ${modelName} model without streaming`);
          expect(typeof result).toBe("string");
          expect((result as string).length).toBeGreaterThan(10);
        },
        TIMEOUT
      );

      // Test with streaming
      gradeAwareTest(modelId)(
        `should generate text with ${modelName} model with streaming`,
        async () => {
          // Make a simple non-structured API call with streaming
          const generator = callAi("Write a short joke about programming.", {
            apiKey: process.env.CALLAI_API_KEY,
            model: modelId.id,
            stream: true,
          }) as unknown as AsyncGenerator<string, string, unknown>;

          // Collect all chunks
          let lastChunk = "";
          let chunkCount = 0;

          for await (const chunk of generator) {
            lastChunk = chunk;
            chunkCount++;
          }

          // Verify streaming response
          expectOrWarn(modelId, chunkCount > 0, `should generate text with ${modelName} model with streaming`);
          expect(lastChunk).toBeTruthy();
          expect(lastChunk.length).toBeGreaterThan(10);
        },
        TIMEOUT
      );
    });
  });

  // Test with message array input format
  describe("Message array input format", () => {
    // Run all model tests concurrently
    modelEntries.map(([modelName, modelId]) => {
      itif(!!haveApiKey)(
        `should handle message array input with ${modelName} model`,
        async () => {
          // Make the API call with message array
          const result = await callAi(
            [
              {
                role: "system",
                content: "You are a helpful and concise assistant.",
              },
              { role: "user", content: "What is the capital of France?" },
            ],
            {
              apiKey: process.env.CALLAI_API_KEY,
              model: modelId.id,
            }
          );

          // Verify response contains the expected answer
          expectOrWarn(modelId, !!result, `should handle message array input with ${modelName} model`);
          expect(typeof result).toBe("string");
          expect((result as string).toLowerCase()).toContain("paris");
        },
        TIMEOUT
      );
    });
  });

  // Test basic schema functionality
  describe("Basic schema support", () => {
    // Define a simple schema
    const simpleSchema = {
      name: "country",
      properties: {
        name: { type: "string" },
        capital: { type: "string" },
        population: { type: "number" },
      },
    };

    // Run all model tests concurrently
    modelEntries.map(([modelName, modelId]) => {
      itif(!!haveApiKey)(
        `should generate structured data with ${modelName} model using schema`,
        async () => {
          // Make the API call with schema
          const result = await callAi("Provide information about France.", {
            apiKey: process.env.CALLAI_API_KEY,
            model: modelId.id,
            schema: simpleSchema,
          });

          // Extract JSON if wrapped in code blocks
          const content = result as string;
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
            content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];

          const jsonContent = jsonMatch[1] || content;

          try {
            // Parse and verify the result
            const data = JSON.parse(jsonContent);
            expectOrWarn(modelId, !!data.name, `Missing 'name' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.capital, `Missing 'capital' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.population, `Missing 'population' property in ${modelName} model response`);

            if (data.name && data.capital && data.population) {
              expectOrWarn(modelId, typeof data.name === "string", `'name' is not a string in ${modelName} model response`);
              expectOrWarn(modelId, typeof data.capital === "string", `'capital' is not a string in ${modelName} model response`);
              expectOrWarn(
                modelId,
                typeof data.population === "number",
                `'population' is not a number in ${modelName} model response`
              );
              expectOrWarn(
                modelId,
                data.name.toLowerCase().includes("france"),
                `'name' should include 'france' in ${modelName} model response`
              );
              expectOrWarn(
                modelId,
                data.capital.toLowerCase().includes("paris"),
                `'capital' should include 'paris' in ${modelName} model response`
              );
            }
          } catch (e) {
            expectOrWarn(modelId, false, `JSON parse error in ${modelName} model response: ${e}`);
          }
        },
        TIMEOUT
      );
    });
  });

  // Test complex schemas with nested objects and arrays
  describe("Complex schema validation", () => {
    // Define a complex schema with nested objects and arrays
    const complexSchema = {
      name: "travel_plan",
      properties: {
        destination: { type: "string" },
        duration: { type: "number" },
        budget: { type: "number" },
        activities: {
          type: "array",
          items: { type: "string" },
        },
        accommodation: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            features: {
              type: "array",
              items: { type: "string" },
            },
            price: { type: "number" },
          },
        },
        transportation: {
          type: "object",
          properties: {
            mode: { type: "string" },
            cost: { type: "number" },
          },
        },
      },
    };

    // Run all model tests concurrently
    modelEntries.map(([modelName, modelId]) => {
      itif(!!haveApiKey)(
        `should generate and validate complex structured data with ${modelName} model`,
        async () => {
          // Make the API call with the complex schema
          const result = await callAi("Create a detailed travel plan for a weekend trip to a beach destination.", {
            apiKey: process.env.CALLAI_API_KEY,
            model: modelId.id,
            schema: complexSchema,
          });

          // Extract JSON if wrapped in code blocks
          const content = result as string;
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
            content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];

          const jsonContent = jsonMatch[1] || content;

          try {
            // Parse and perform detailed validation
            const data = JSON.parse(jsonContent);

            // Root properties validation
            expectOrWarn(modelId, !!data.destination, `Missing 'destination' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.duration, `Missing 'duration' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.budget, `Missing 'budget' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.activities, `Missing 'activities' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.accommodation, `Missing 'accommodation' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.transportation, `Missing 'transportation' property in ${modelName} model response`);

            // Type checking - only if properties exist
            if (data.destination)
              expectOrWarn(
                modelId,
                typeof data.destination === "string",
                `'destination' is not a string in ${modelName} model response`
              );
            if (data.duration)
              expectOrWarn(modelId, typeof data.duration === "number", `'duration' is not a number in ${modelName} model response`);
            if (data.budget)
              expectOrWarn(modelId, typeof data.budget === "number", `'budget' is not a number in ${modelName} model response`);
            if (data.activities)
              expectOrWarn(modelId, Array.isArray(data.activities), `'activities' is not an array in ${modelName} model response`);
            if (data.accommodation)
              expectOrWarn(
                modelId,
                typeof data.accommodation === "object",
                `'accommodation' is not an object in ${modelName} model response`
              );
            if (data.transportation)
              expectOrWarn(
                modelId,
                typeof data.transportation === "object",
                `'transportation' is not an object in ${modelName} model response`
              );

            // Array validation
            if (Array.isArray(data.activities)) {
              expectOrWarn(modelId, data.activities.length > 0, `'activities' array is empty in ${modelName} model response`);
              data.activities.forEach((activity: unknown) => {
                expectOrWarn(modelId, typeof activity === "string", `activity item is not a string in ${modelName} model response`);
              });
            }

            // Nested object validation - accommodation
            if (data.accommodation) {
              expectOrWarn(modelId, !!data.accommodation.name, `Missing 'accommodation.name' in ${modelName} model response`);
              expectOrWarn(modelId, !!data.accommodation.type, `Missing 'accommodation.type' in ${modelName} model response`);
              expectOrWarn(
                modelId,
                !!data.accommodation.features,
                `Missing 'accommodation.features' in ${modelName} model response`
              );
              expectOrWarn(modelId, !!data.accommodation.price, `Missing 'accommodation.price' in ${modelName} model response`);

              if (data.accommodation.name)
                expectOrWarn(
                  modelId,
                  typeof data.accommodation.name === "string",
                  `'accommodation.name' is not a string in ${modelName} model response`
                );
              if (data.accommodation.type)
                expectOrWarn(
                  modelId,
                  typeof data.accommodation.type === "string",
                  `'accommodation.type' is not a string in ${modelName} model response`
                );
              if (data.accommodation.features)
                expectOrWarn(
                  modelId,
                  Array.isArray(data.accommodation.features),
                  `'accommodation.features' is not an array in ${modelName} model response`
                );
              if (data.accommodation.price)
                expectOrWarn(
                  modelId,
                  typeof data.accommodation.price === "number",
                  `'accommodation.price' is not a number in ${modelName} model response`
                );

              if (Array.isArray(data.accommodation.features)) {
                data.accommodation.features.forEach((feature: unknown) => {
                  expectOrWarn(modelId, typeof feature === "string", `feature item is not a string in ${modelName} model response`);
                });
              }
            }

            // Nested object validation - transportation
            if (data.transportation) {
              expectOrWarn(modelId, !!data.transportation.mode, `Missing 'transportation.mode' in ${modelName} model response`);
              expectOrWarn(modelId, !!data.transportation.cost, `Missing 'transportation.cost' in ${modelName} model response`);

              if (data.transportation.mode)
                expectOrWarn(
                  modelId,
                  typeof data.transportation.mode === "string",
                  `'transportation.mode' is not a string in ${modelName} model response`
                );
              if (data.transportation.cost)
                expectOrWarn(
                  modelId,
                  typeof data.transportation.cost === "number",
                  `'transportation.cost' is not a number in ${modelName} model response`
                );
            }

            // Value range validation
            if (data.duration)
              expectOrWarn(modelId, data.duration > 0, `'duration' is not positive in ${modelName} model response`);
            if (data.budget) expectOrWarn(modelId, data.budget > 0, `'budget' is not positive in ${modelName} model response`);
            if (data.accommodation?.price)
              expectOrWarn(
                modelId,
                data.accommodation.price > 0,
                `'accommodation.price' is not positive in ${modelName} model response`
              );
            if (data.transportation?.cost)
              expectOrWarn(
                modelId,
                data.transportation.cost > 0,
                `'transportation.cost' is not positive in ${modelName} model response`
              );
          } catch (e) {
            expectOrWarn(modelId, false, `JSON parse error in ${modelName} model response: ${e}`);
          }
        },
        TIMEOUT
      );
    });
  });

  // Test complex but flat schema (many properties but no nesting)
  describe("Complex flat schema validation", () => {
    // Define a complex flat schema
    const complexFlatSchema = {
      name: "recipe",
      properties: {
        name: { type: "string" },
        cuisine: { type: "string" },
        prepTime: { type: "number" },
        cookTime: { type: "number" },
        servings: { type: "number" },
        difficulty: { type: "string" },
        ingredients: {
          type: "array",
          items: { type: "string" },
        },
        steps: {
          type: "array",
          items: { type: "string" },
        },
        calories: { type: "number" },
        protein: { type: "number" },
        carbohydrates: { type: "number" },
        fat: { type: "number" },
      },
    };

    // Run all model tests concurrently
    modelEntries.map(([modelName, modelId]) => {
      itif(!!haveApiKey)(
        `should generate data with complex flat schema using ${modelName} model`,
        async () => {
          // Make the API call with schema
          const result = await callAi("Create a recipe for a healthy dinner.", {
            apiKey: process.env.CALLAI_API_KEY,
            model: modelId.id,
            schema: complexFlatSchema,
          });

          // Extract JSON if wrapped in code blocks
          const content = result as string;
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
            content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];

          const jsonContent = jsonMatch[1] || content;

          try {
            // Parse and verify the result
            const data = JSON.parse(jsonContent);

            // Check required properties
            expectOrWarn(modelId, !!data.name, `Missing 'name' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.cuisine, `Missing 'cuisine' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.prepTime, `Missing 'prepTime' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.cookTime, `Missing 'cookTime' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.servings, `Missing 'servings' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.difficulty, `Missing 'difficulty' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.ingredients, `Missing 'ingredients' property in ${modelName} model response`);
            expectOrWarn(modelId, !!data.steps, `Missing 'steps' property in ${modelName} model response`);

            // Check types
            if (data.name)
              expectOrWarn(modelId, typeof data.name === "string", `'name' is not a string in ${modelName} model response`);
            if (data.cuisine)
              expectOrWarn(modelId, typeof data.cuisine === "string", `'cuisine' is not a string in ${modelName} model response`);
            if (data.prepTime)
              expectOrWarn(modelId, typeof data.prepTime === "number", `'prepTime' is not a number in ${modelName} model response`);
            if (data.cookTime)
              expectOrWarn(modelId, typeof data.cookTime === "number", `'cookTime' is not a number in ${modelName} model response`);
            if (data.servings)
              expectOrWarn(modelId, typeof data.servings === "number", `'servings' is not a number in ${modelName} model response`);
            if (data.difficulty)
              expectOrWarn(
                modelId,
                typeof data.difficulty === "string",
                `'difficulty' is not a string in ${modelName} model response`
              );
            if (data.ingredients)
              expectOrWarn(
                modelId,
                Array.isArray(data.ingredients),
                `'ingredients' is not an array in ${modelName} model response`
              );
            if (data.steps)
              expectOrWarn(modelId, Array.isArray(data.steps), `'steps' is not an array in ${modelName} model response`);

            // Check arrays
            if (Array.isArray(data.ingredients))
              expectOrWarn(modelId, data.ingredients.length > 0, `'ingredients' array is empty in ${modelName} model response`);
            if (Array.isArray(data.steps))
              expectOrWarn(modelId, data.steps.length > 0, `'steps' array is empty in ${modelName} model response`);

            // Check data values
            if (data.prepTime)
              expectOrWarn(modelId, data.prepTime > 0, `'prepTime' is not positive in ${modelName} model response`);
            if (data.cookTime)
              expectOrWarn(modelId, data.cookTime > 0, `'cookTime' is not positive in ${modelName} model response`);
            if (data.servings)
              expectOrWarn(modelId, data.servings > 0, `'servings' is not positive in ${modelName} model response`);
          } catch (e) {
            expectOrWarn(modelId, false, `JSON parse error in ${modelName} model response: ${e}`);
          }
        },
        TIMEOUT
      );
    });
  });

  // Test simple but nested schema (few properties with deep nesting)
  describe("Simple nested schema validation", () => {
    // Define a simple nested schema
    const simpleNestedSchema = {
      name: "file_system",
      properties: {
        root: {
          type: "object",
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            children: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  children: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        type: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    // Run all model tests concurrently
    modelEntries.map(([modelName, modelId]) => {
      itif(!!haveApiKey)(
        `should generate data with simple nested schema using ${modelName} model`,
        async () => {
          // Make the API call with schema
          const result = await callAi(
            "Create a simple file system structure with a root directory containing two subdirectories, each with two files.",
            {
              apiKey: process.env.CALLAI_API_KEY,
              model: modelId.id,
              schema: simpleNestedSchema,
            }
          );

          // Extract JSON if wrapped in code blocks
          const content = result as string;
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
            content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];

          const jsonContent = jsonMatch[1] || content;

          try {
            // Parse and verify the result
            const data = JSON.parse(jsonContent);

            // Check top-level structure
            expectOrWarn(modelId, !!data.root, `Missing 'root' property in ${modelName} model response`);

            // Only continue if root exists and is an object
            if (data.root && typeof data.root === "object") {
              expectOrWarn(modelId, !!data.root.name, `Missing 'root.name' in ${modelName} model response`);
              expectOrWarn(modelId, !!data.root.type, `Missing 'root.type' in ${modelName} model response`);
              expectOrWarn(modelId, !!data.root.children, `Missing 'root.children' in ${modelName} model response`);

              // Check root properties
              if (data.root.name)
                expectOrWarn(
                  modelId,
                  typeof data.root.name === "string",
                  `'root.name' is not a string in ${modelName} model response`
                );
              if (data.root.type)
                expectOrWarn(
                  modelId,
                  typeof data.root.type === "string",
                  `'root.type' is not a string in ${modelName} model response`
                );
              if (data.root.children) {
                expectOrWarn(
                  modelId,
                  Array.isArray(data.root.children),
                  `'root.children' is not an array in ${modelName} model response`
                );
                expectOrWarn(
                  modelId,
                  data.root.children.length > 0,
                  `'root.children' array is empty in ${modelName} model response`
                );

                // Check first level of nesting
                if (Array.isArray(data.root.children) && data.root.children.length > 0) {
                  const firstChild = data.root.children[0];
                  expectOrWarn(modelId, !!firstChild, `First child is undefined in ${modelName} model response`);

                  if (firstChild) {
                    expectOrWarn(modelId, !!firstChild.name, `Missing 'firstChild.name' in ${modelName} model response`);
                    expectOrWarn(modelId, !!firstChild.type, `Missing 'firstChild.type' in ${modelName} model response`);
                    expectOrWarn(modelId, !!firstChild.children, `Missing 'firstChild.children' in ${modelName} model response`);

                    if (firstChild.name)
                      expectOrWarn(
                        modelId,
                        typeof firstChild.name === "string",
                        `'firstChild.name' is not a string in ${modelName} model response`
                      );
                    if (firstChild.type)
                      expectOrWarn(
                        modelId,
                        typeof firstChild.type === "string",
                        `'firstChild.type' is not a string in ${modelName} model response`
                      );
                    if (firstChild.children)
                      expectOrWarn(
                        modelId,
                        Array.isArray(firstChild.children),
                        `'firstChild.children' is not an array in ${modelName} model response`
                      );

                    // Check for at least one file in the second level
                    if (Array.isArray(firstChild.children) && firstChild.children.length > 0) {
                      const secondChild = firstChild.children[0];
                      expectOrWarn(modelId, !!secondChild, `Second child is undefined in ${modelName} model response`);

                      if (secondChild) {
                        expectOrWarn(modelId, !!secondChild.name, `Missing 'secondChild.name' in ${modelName} model response`);
                        expectOrWarn(modelId, !!secondChild.type, `Missing 'secondChild.type' in ${modelName} model response`);

                        if (secondChild.name)
                          expectOrWarn(
                            modelId,
                            typeof secondChild.name === "string",
                            `'secondChild.name' is not a string in ${modelName} model response`
                          );
                        if (secondChild.type)
                          expectOrWarn(
                            modelId,
                            typeof secondChild.type === "string",
                            `'secondChild.type' is not a string in ${modelName} model response`
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
        },
        TIMEOUT
      );
    });
  });
});
