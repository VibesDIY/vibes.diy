/**
 * Image generation API implementation for call-ai
 * Integration with custom image generation API
 */
import { ImageGenOptions, ImageResponse } from "./types.js";
import { callAiFetch, joinUrlParts } from "./utils.js";
import { callAiEnv } from "./env.js";
import { PACKAGE_VERSION } from "./version.js";

// Import package version for debugging (same as main API)

/**
 * Generate images using a custom API that mimics OpenAI's image generation capabilities
 * @param prompt Text prompt describing the image to generate
 * @param options Configuration options for the image generation request
 * @returns A Promise that resolves to the image response containing base64 encoded image data
 */
export async function imageGen(prompt: string, options: ImageGenOptions = {}): Promise<ImageResponse> {
  const { model = "gpt-image-1", apiKey = callAiEnv.CALLAI_API_KEY, debug = false, size = "1024x1024" } = options;

  if (!apiKey) {
    throw new Error("API key is required for image generation. Provide via options.apiKey or set window.CALLAI_API_KEY");
  }

  if (debug) {
    console.log(`[imageGen:${PACKAGE_VERSION}] Generating image with prompt: ${prompt.substring(0, 50)}...`);
    console.log(`[imageGen:${PACKAGE_VERSION}] Using model: ${model}`);
  }

  // Get custom origin if set
  const customOrigin = options.imgUrl || callAiEnv.CALLAI_IMG_URL;

  try {
    // Handle image generation
    if (!options.images || options.images.length === 0) {
      // Simple image generation with text prompt
      // Use custom origin or proper API fallback
      const origin = customOrigin || callAiEnv.def.CALLAI_CHAT_URL;
      const generateEndpoint = joinUrlParts(origin, "/api/openai-image/generate");

      if (!apiKey) {
        throw new Error("API key is required for image generation (simple)");
      }

      // HTTP headers for the request
      const headers = new Headers({
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      });

      const response = await callAiFetch(options)(generateEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          prompt,
          size,
          ...(options.quality && { quality: options.quality }),
          ...(options.style && { style: options.style }),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Image generation failed: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const responseText = await response.text();
      if (debug) {
        console.log(`[imageGen:${PACKAGE_VERSION}] Raw response:`, responseText.substring(0, 500) + "...");
      }

      try {
        const result = JSON.parse(responseText);
        return result;
      } catch (parseError) {
        if (debug) {
          console.error(`[imageGen:${PACKAGE_VERSION}] JSON Parse Error:`, parseError);
          console.error(`[imageGen:${PACKAGE_VERSION}] Response text length:`, responseText.length);
          console.error(`[imageGen:${PACKAGE_VERSION}] Response sample:`, responseText.substring(0, 1000));
        }
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
      }
    } else {
      // Image editing with multiple input images
      const formData = new FormData();
      formData.append("model", model);
      formData.append("prompt", prompt);

      // Add each image to the form data
      options.images.forEach((image, index) => {
        formData.append(`image_${index}`, image);
      });

      // Add parameters
      formData.append("size", size);
      if (options.quality) formData.append("quality", options.quality);
      if (options.style) formData.append("style", options.style);

      // Use custom origin or proper API fallback
      const origin = customOrigin || callAiEnv.def.CALLAI_CHAT_URL;
      const editEndpoint = joinUrlParts(origin, "/api/openai-image/edit");

      if (!apiKey) {
        throw new Error("API key is required for image generation (edit)");
      }

      // HTTP headers for the request
      const headers = new Headers({
        Authorization: `Bearer ${apiKey}`,
      });

      const response = await callAiFetch(options)(editEndpoint, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Image editing failed: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const responseText = await response.text();
      if (debug) {
        console.log(`[imageGen:${PACKAGE_VERSION}] Raw response:`, responseText.substring(0, 500) + "...");
      }

      try {
        const result = JSON.parse(responseText);
        return result;
      } catch (parseError) {
        if (debug) {
          console.error(`[imageGen:${PACKAGE_VERSION}] JSON Parse Error:`, parseError);
          console.error(`[imageGen:${PACKAGE_VERSION}] Response text length:`, responseText.length);
          console.error(`[imageGen:${PACKAGE_VERSION}] Response sample:`, responseText.substring(0, 1000));
        }
        throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`);
      }
    }
  } catch (error) {
    if (debug) {
      console.error(`[imageGen:${PACKAGE_VERSION}] Error:`, error);
    }
    throw error;
  }
}
