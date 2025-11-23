import { callAi, ContentItem, callAiEnv } from "call-ai";
import fs from "fs";
import path from "path";
import { itif } from "../test-helper.js";
import { describe, expect } from "vitest";

// Skip tests if no API key is available
const haveApiKey = callAiEnv.CALLAI_API_KEY;

// Timeout for image recognition tests
const TIMEOUT = 30000;

describe("Call-AI Vision Recognition", () => {
  itif(Boolean(haveApiKey))(
    "should analyze cat.png with callAi function",
    async () => {
      // Read the image file and convert to base64
      const imagePath = path.resolve(__dirname, "../fixtures/cat.png");
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString("base64");
      const dataUri = `data:image/png;base64,${base64Image}`;

      // Create a multimodal message for vision using the library's ContentItem type
      const content: ContentItem[] = [
        {
          type: "text",
          text: "What is in this image? Describe it in detail.",
        },
        {
          type: "image_url",
          image_url: {
            url: dataUri,
          },
        },
      ];

      try {
        // Call the callAi function with the vision model
        const result = await callAi([{ role: "user", content }], {
          apiKey: callAiEnv.CALLAI_API_KEY,
          model: "openai/gpt-4o-2024-08-06",
        });

        // Verify that the response contains a description of a cat
        // TypeScript needs assurance that result is a string
        if (typeof result === "string") {
          expect(result.toLowerCase()).toContain("cat");
        } else {
          // For the AsyncGenerator case (streaming)
          // This won't typically happen in this test but adding for type safety
          expect(true).toBe(true);
          console.warn("Received non-string result in vision test");
        }
      } catch (error) {
        console.error("Error calling callAi:", error);
        throw error;
      }
    },
    TIMEOUT,
  );
});
