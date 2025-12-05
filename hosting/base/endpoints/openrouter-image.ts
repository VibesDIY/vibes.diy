import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { Context as HonoContext } from "hono";

// TypeScript interfaces for image generation requests
interface ImageGenerateRequest {
  prompt: string;
  model?: string;
  n?: number;
  quality?: string;
  size?: string;
  background?: string;
  output_format?: string;
  output_compression?: number | null;
  moderation?: string;
  userId?: string;
}

type ImageEditRequest = ImageGenerateRequest;

// OpenRouter image generation response type
interface OpenRouterImageResponse {
  id?: string;
  created?: number;
  choices?: Array<{
    message?: {
      content?: string;
      images?: Array<{
        type: string;
        image_url?: { url: string };
      }>;
    };
  }>;
}

// Map OpenAI size format to OpenRouter aspect_ratio
// Supported aspect ratios per OpenRouter docs:
// 1:1 → 1024×1024, 2:3 → 832×1248, 3:2 → 1248×832, 3:4 → 864×1184
// 4:3 → 1184×864, 4:5 → 896×1152, 5:4 → 1152×896, 9:16 → 768×1344
// 16:9 → 1344×768, 21:9 → 1536×672
function sizeToAspectRatio(size: string): string {
  const sizeMap: Record<string, string> = {
    "1024x1024": "1:1",
    "1344x768": "16:9",
    "768x1344": "9:16",
    "1248x832": "3:2",
    "832x1248": "2:3",
    "1184x864": "4:3",
    "864x1184": "3:4",
    "1152x896": "5:4",
    "896x1152": "4:5",
    "1536x672": "21:9",
    // Legacy OpenAI sizes - map to closest aspect ratio
    "1792x1024": "16:9",
    "1024x1792": "9:16",
    "1536x1024": "3:2",
    "1024x1536": "2:3",
    auto: "1:1",
  };
  return sizeMap[size] || "1:1";
}

// Transform OpenRouter response to OpenAI-compatible format
// OpenRouter returns images in message.images array, each with type: "image_url" and image_url.url
function transformResponse(openRouterResponse: OpenRouterImageResponse): {
  created: number;
  data: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
} {
  const data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }> = [];

  if (openRouterResponse.choices && openRouterResponse.choices.length > 0) {
    const message = openRouterResponse.choices[0].message;
    // Images are in message.images array per OpenRouter API docs
    if (message?.images && Array.isArray(message.images)) {
      for (const item of message.images) {
        if (item.type === "image_url" && item.image_url?.url) {
          const url = item.image_url.url;
          // OpenRouter returns base64 data URLs
          if (url.startsWith("data:image/")) {
            // Extract base64 data from data URL
            const base64Match = url.match(/^data:image\/[^;]+;base64,(.+)$/);
            if (base64Match) {
              data.push({ b64_json: base64Match[1] });
            } else {
              data.push({ url });
            }
          } else {
            data.push({ url });
          }
        }
      }
    }
  }

  return {
    created: openRouterResponse.created || Math.floor(Date.now() / 1000),
    data,
  };
}

// Core function to generate images using OpenRouter API
async function generateImage(
  params: ImageGenerateRequest,
  apiKey: string,
  referer: string,
): Promise<Response> {
  try {
    const {
      prompt,
      model = "google/gemini-2.5-flash-image",
      n = 1,
      size = "auto",
      userId = "anonymous",
    } = params;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const aspectRatio = sizeToAspectRatio(size);

    // Prepare OpenRouter chat completion request with image modality
    const requestBody = {
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: aspectRatio,
      },
      n,
      user: userId,
    };

    // Send request to OpenRouter API
    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
          "X-Title": "Vibes DIY",
        },
        body: JSON.stringify(requestBody),
      },
    );

    // Handle API errors
    if (!openRouterResponse.ok) {
      let errorData;
      let errorText;

      try {
        errorText = await openRouterResponse.text();
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
      } catch (parseError: unknown) {
        console.error(
          `❌ OpenRouter Image: Error parsing error response:`,
          parseError,
        );
        errorData = {
          message: `Failed to parse error response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        };
      }

      console.error(`❌ OpenRouter Image: Error generating image:`, errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to generate image",
          details: errorData,
        }),
        {
          status: openRouterResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Parse and transform response to OpenAI-compatible format
    const responseData =
      (await openRouterResponse.json()) as OpenRouterImageResponse;
    const transformedResponse = transformResponse(responseData);

    return new Response(JSON.stringify(transformedResponse), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

// Core function to edit images using OpenRouter API
export async function editImage(
  c: HonoContext,
  params: ImageEditRequest,
  apiKey: string,
): Promise<Response> {
  try {
    const {
      prompt,
      model = "google/gemini-2.5-flash-image",
      size = "auto",
      userId = "anonymous",
    } = params;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Process form data to extract images
    const formData = await c.req.formData();
    const imageDataUrls: string[] = [];

    for (const [name, value] of formData.entries()) {
      if (
        (name === "image" ||
          name === "images[]" ||
          name === "image[]" ||
          name.match(/^image_\d+$/)) &&
        value instanceof File
      ) {
        const arrayBuffer = await value.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);
        const mimeType = value.type || "image/png";
        imageDataUrls.push(`data:${mimeType};base64,${base64}`);
      }
    }

    if (imageDataUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one image must be provided" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    const aspectRatio = sizeToAspectRatio(size);

    // Build multimodal content with images and text prompt
    const content: Array<
      | { type: "image_url"; image_url: { url: string } }
      | { type: "text"; text: string }
    > = [];

    // Add images first
    for (const dataUrl of imageDataUrls) {
      content.push({
        type: "image_url",
        image_url: { url: dataUrl },
      });
    }

    // Add the editing prompt
    content.push({
      type: "text",
      text: prompt,
    });

    // Prepare OpenRouter chat completion request with image modality
    const requestBody = {
      model,
      messages: [
        {
          role: "user",
          content,
        },
      ],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: aspectRatio,
      },
      user: userId,
    };

    const referer = c.req.header("Referer") || "https://vibes.diy";

    // Send request to OpenRouter API
    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": referer,
          "X-Title": "Vibes DIY",
        },
        body: JSON.stringify(requestBody),
      },
    );

    // Handle API errors
    if (!openRouterResponse.ok) {
      let errorData;
      const contentType = openRouterResponse.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        errorData = await openRouterResponse.json();
      } else {
        const textResponse = await openRouterResponse.text();
        console.error(
          `❌ OpenRouter Image: Non-JSON error response:`,
          textResponse.substring(0, 200),
        );
        errorData = {
          message: `Non-JSON response (${contentType}): ${textResponse.substring(0, 100)}...`,
        };
      }

      console.error(`❌ OpenRouter Image: Error editing image:`, errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to edit image",
          details: errorData,
        }),
        {
          status: openRouterResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Parse and transform response to OpenAI-compatible format
    const responseData =
      (await openRouterResponse.json()) as OpenRouterImageResponse;
    const transformedResponse = transformResponse(responseData);

    return new Response(JSON.stringify(transformedResponse), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: unknown) {
    console.error(`❌ OpenRouter Image: Error in editImage:`, error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Hono compatible OpenRouter Image Generator route
export class OpenRouterImageGenerate extends OpenAPIRoute {
  schema = {
    tags: ["OpenRouter"],
    summary: "Generate images using OpenRouter API",
    request: {
      body: contentJson(
        z.object({
          prompt: z.string().describe("The image generation prompt"),
          model: z
            .string()
            .optional()
            .default("google/gemini-2.5-flash-image")
            .describe("The model to use (e.g., google/gemini-2.5-flash-image)"),
          n: z
            .number()
            .optional()
            .default(1)
            .describe("Number of images to generate"),
          quality: z
            .string()
            .optional()
            .default("auto")
            .describe("Image quality (passed to model if supported)"),
          size: z
            .string()
            .optional()
            .default("auto")
            .describe(
              "Image size: auto, 1024x1024, 1792x1024, 1024x1792, etc.",
            ),
          background: z
            .string()
            .optional()
            .default("auto")
            .describe("Background style (passed to model if supported)"),
          output_format: z
            .string()
            .optional()
            .default("png")
            .describe("Output format (model dependent)"),
          output_compression: z
            .number()
            .nullable()
            .optional()
            .describe("Compression level (model dependent)"),
          moderation: z
            .string()
            .optional()
            .default("auto")
            .describe("Moderation level (model dependent)"),
          userId: z
            .string()
            .optional()
            .describe("User ID for API billing and tracking"),
        }),
      ),
    },
    responses: {
      200: {
        description: "Returns the generated image data",
        ...contentJson(
          z.object({
            created: z.number(),
            data: z.array(
              z.object({
                url: z.string().optional(),
                b64_json: z.string().optional(),
                revised_prompt: z.string().optional(),
              }),
            ),
          }),
        ),
      },
    },
  };

  async handle(c: HonoContext) {
    try {
      const data = await c.req.json();

      // Require authentication
      const user = c.get("user");
      if (!user) {
        return c.json(
          {
            error: {
              message:
                "Authentication required. Please log in to use AI features.",
              type: "authentication_error",
              code: 401,
            },
          },
          401,
        );
      }

      const requestBody: ImageGenerateRequest = {
        prompt: data.prompt,
        model: data.model || "google/gemini-2.5-flash-image",
        n: data.n || 1,
        quality: data.quality || "auto",
        size: data.size || "auto",
        background: data.background || "auto",
        output_format: data.output_format || "png",
        output_compression:
          data.output_compression !== undefined
            ? data.output_compression
            : null,
        moderation: data.moderation || "auto",
        userId: user?.userId || "anonymous",
      };

      const apiKey = c.env.SERVER_OPENROUTER_API_KEY;
      if (!apiKey) {
        return c.json(
          {
            error: {
              message: "OpenRouter API key not configured",
              type: "server_error",
              code: 500,
            },
          },
          500,
        );
      }

      const referer = c.req.header("Referer") || "https://vibes.diy";
      const response = await generateImage(requestBody, apiKey, referer);

      return response;
    } catch (error: unknown) {
      console.error("Error in OpenRouterImageGenerate handler:", error);
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred processing your request",
        },
        500,
      );
    }
  }
}

// Hono compatible OpenRouter Image Editor route
export class OpenRouterImageEdit extends OpenAPIRoute {
  schema = {
    tags: ["OpenRouter"],
    summary:
      "Edit images using OpenRouter API - accepts multipart/form-data with image files and text parameters",
    description:
      "Upload image file(s) along with editing parameters. Accepts 'image' files plus text fields: prompt, model, size, userId",
    responses: {
      200: {
        description: "Returns the edited image data",
        ...contentJson(
          z.object({
            created: z.number(),
            data: z.array(
              z.object({
                url: z.string().optional(),
                b64_json: z.string().optional(),
                revised_prompt: z.string().optional(),
              }),
            ),
          }),
        ),
      },
    },
  };

  async handle(c: HonoContext) {
    try {
      // Require authentication
      const user = c.get("user");
      if (!user) {
        return c.json(
          {
            error: {
              message:
                "Authentication required. Please log in to use AI features.",
              type: "authentication_error",
              code: 401,
            },
          },
          401,
        );
      }

      const requestBody: ImageEditRequest = {
        prompt: "",
        userId: "anonymous",
      };

      const formData = await c.req.formData();

      requestBody.prompt = formData.get("prompt")?.toString() || "";
      requestBody.model =
        formData.get("model")?.toString() || "google/gemini-2.5-flash-image";
      requestBody.n = parseInt(formData.get("n")?.toString() || "1", 10);
      requestBody.quality = formData.get("quality")?.toString() || "auto";
      requestBody.size = formData.get("size")?.toString() || "auto";
      requestBody.background = formData.get("background")?.toString() || "auto";
      requestBody.output_format =
        formData.get("output_format")?.toString() || "png";

      const output_compression_str = formData
        .get("output_compression")
        ?.toString();
      requestBody.output_compression = output_compression_str
        ? parseInt(output_compression_str, 10)
        : null;

      requestBody.moderation = formData.get("moderation")?.toString() || "auto";
      requestBody.userId = user?.userId || "anonymous";

      const apiKey = c.env.SERVER_OPENROUTER_API_KEY;
      if (!apiKey) {
        return c.json(
          {
            error: {
              message: "OpenRouter API key not configured",
              type: "server_error",
              code: 500,
            },
          },
          500,
        );
      }

      const response = await editImage(c, requestBody, apiKey);

      return response;
    } catch (error: unknown) {
      console.error("Error in OpenRouterImageEdit handler:", error);
      return c.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred processing your request",
        },
        500,
      );
    }
  }
}
