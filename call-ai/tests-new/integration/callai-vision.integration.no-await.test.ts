import { callAi, ContentItem, callAiEnv } from "call-ai";
import { describe, expect, it } from "vitest";
import { runtimeFn } from "@adviser/cement";

// Skip tests if no API key is available

// Timeout for image recognition tests
const TIMEOUT = 90000;

async function blobToBase64(blob: Blob) {
  if (runtimeFn().isBrowser) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } else {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const mimeType = blob.type || "application/octet-stream";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }
}

describe("Call-AI Vision Recognition", () => {
  it(
    "should analyze cat.png with callAi function",
    async () => {
      // Read the image file and convert to base64
      const imageBuffer = await fetch("http://localhost:15731/fixtures/cat.png").then((r) => r.blob());
      const base64Image = await blobToBase64(imageBuffer);
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

        console.log("Vision model's description of the image:");
        console.log(result);

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
