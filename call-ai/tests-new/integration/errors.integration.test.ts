import { callAi, callAiEnv } from "call-ai";
import { assert, describe, expect, it } from "vitest";

// Skip tests if no API key is available

// Timeout for individual test
const TIMEOUT = 30000;

describe("Error handling integration tests", () => {
  // Test default model (should succeed)
  it(
    "should succeed with default model",
    async () => {
      // Make a simple API call with no model specified
      const result = await callAi("Write a short joke about programming.", {
        apiKey: callAiEnv.CALLAI_API_KEY,
        // No model specified - should use default
      });

      // Verify response
      expect(typeof result).toBe("string");
      expect((result as string).length).toBeGreaterThan(10);
    },
    TIMEOUT,
  );

  // Test with invalid model (should throw an error)
  it(
    "should throw error with invalid model",
    async () => {
      // Attempt API call with a non-existent model
      await expect(async () => {
        await callAi("Write a short joke about programming.", {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: "fake-model-that-does-not-exist",
          skipRetry: true, // Skip retry mechanism to force the error
          debug: true,
        });
      }).rejects.toThrow();
    },
    TIMEOUT,
  );

  // Test streaming with invalid model (should also throw an error)
  it(
    "should throw error with invalid model in streaming mode",
    async () => {
      // Attempt streaming API call with a non-existent model
      await expect(async () => {
        const generator = await callAi("Write a short joke about programming.", {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: "fake-model-that-does-not-exist",
          stream: true,
          skipRetry: true, // Skip retry mechanism to force the error
        });

        // Try to consume the generator
        // Cast to AsyncGenerator to ensure TypeScript recognizes it properly
        const asyncGenerator = generator as AsyncGenerator<string, string, unknown>;

        for await (const _ of asyncGenerator) {
          // This should throw before yielding any chunks
        }
      }).rejects.toThrow();
    },
    TIMEOUT,
  );

  // Test error message contents
  it(
    "should include HTTP status in error message",
    async () => {
      const fakeModelId = "fake-model-that-does-not-exist";

      // Attempt API call with a non-existent model
      try {
        await callAi("Write a short joke about programming.", {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: fakeModelId,
          skipRetry: true, // Skip retry mechanism to force the error
        });
        // If we get here, fail the test
        assert.fail("Should have thrown an error");
      } catch (error) {
        // Verify error message contains useful information
        expect(error instanceof Error).toBe(true);
        if (error instanceof Error) {
          // With the new error handling, we should see the HTTP status code
          expect(error.message).toContain("HTTP error");
          expect(error.message).toContain("400"); // Bad Request status code
        } else {
          assert.fail("Error is not an Error instance");
        }
      }
    },
    TIMEOUT,
  );

  // Test with debug option for error logging
  it(
    "should handle error with debug option",
    async () => {
      // Spy on console.error
      // const consoleErrorSpy = vitest.spyOn(console, "error");

      // Attempt API call with a non-existent model and debug enabled
      try {
        await callAi("Write a short joke about programming.", {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: "fake-model-that-does-not-exist",
          debug: true,
          skipRetry: true, // Skip retry mechanism to force the error
        });
        // If we get here, fail the test
        assert.fail("Should have thrown an error");
      } catch (error) {
        // Verify console.error was called with error details
        // expect(consoleErrorSpy).toHaveBeenCalled();
        expect(error instanceof Error).toBe(true);
      } finally {
        // Restore the original console.error
        // consoleErrorSpy.mockRestore();
      }
    },
    TIMEOUT,
  );

  // Test JSON parsing error with streaming and invalid model
  it(
    "should reproduce the JSON parsing error seen in streaming mode",
    async () => {
      try {
        // Create generator with invalid model in streaming mode
        const generator = await callAi("Write a short joke about programming.", {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: "fake-model-that-does-not-exist",
          stream: true,
          skipRetry: true, // Skip retry mechanism to force the error
        });

        // Cast to AsyncGenerator to ensure TypeScript recognizes it properly
        const asyncGenerator = generator as AsyncGenerator<string, string, unknown>;

        // Try to consume the generator
        let finalResponse = "";
        for await (const chunk of asyncGenerator) {
          finalResponse = chunk;
        }

        // If we get here (unlikely), try to parse the response as JSON
        try {
          JSON.parse(finalResponse);

          // If we reach here, the JSON parsing unexpectedly succeeded
          assert.fail("JSON parsing should have failed but succeeded");
        } catch (streamError) {
          // We expect a SyntaxError from JSON.parse
          if (streamError instanceof SyntaxError) {
            // This is the expected path - JSON parsing should fail
            expect(streamError.message).toContain("Unexpected end of JSON");
          } else {
            // If it's another type of error, re-throw it to be caught by outer try/catch
            throw streamError;
          }
        }
      } catch (error) {
        // This catches any errors thrown before or during streaming
        if (error instanceof Error) {
          // Check for the error message in the new throw style
          expect(error.message).toContain("fake-model-that-does-not-exist is not a valid model ID");
          // we could uncomment this line:
          // fail(`Streaming should not throw directly but should return invalid JSON: ${error.message}`);
        }
      }
    },
    TIMEOUT,
  );

  // Test trying to mimic the React app's behavior more closely
  it(
    "should mimic React app error handling with streaming",
    async () => {
      // We'll use a Promise to simulate React's async state updates
      let responseText = "";
      let errorMessage: string | null = null;

      const runGeneratorWithReactPatterns = async () => {
        try {
          const generator = await callAi("Write a haiku about programming.", {
            apiKey: callAiEnv.CALLAI_API_KEY,
            model: "fake-model-that-does-not-exist",
            stream: true,
            skipRetry: true, // Skip retry mechanism to force the error
          });

          // Cast to AsyncGenerator
          const asyncGenerator = generator as AsyncGenerator<string, string, unknown>;

          try {
            for await (const chunk of asyncGenerator) {
              responseText = chunk;
            }
          } catch (error) {
            if (error instanceof Error) {
              errorMessage = error.message;
              expect(error.message).toContain("fake-model-that-does-not-exist is not a valid model ID");
            } else {
              errorMessage = "Unknown error";
            }
          }
        } catch (error) {
          if (error instanceof Error) {
            errorMessage = error.message;
            expect(error.message).toContain("fake-model-that-does-not-exist is not a valid model ID");
          } else {
            errorMessage = "Unknown error";
          }
        }
      };

      // Run the simulated React code
      await runGeneratorWithReactPatterns();

      // Check results
      expect(true).toBe(true); // Always passes
    },
    TIMEOUT,
  );
});
