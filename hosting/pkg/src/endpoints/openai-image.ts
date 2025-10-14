import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { Context as HonoContext } from "hono";

// TypeScript interfaces for OpenAI Image API requests
export interface ImageGenerateRequest {
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

export interface ImageEditRequest extends ImageGenerateRequest {
  // No additional fields needed at this time
}

// Core function to generate images using OpenAI API
export async function generateImage(
  params: ImageGenerateRequest,
  apiKey: string,
): Promise<Response> {
  console.log(
    `🖼️ OpenAI Image: Generating image, userId: ${params.userId || "anonymous"}`,
  );

  try {
    const {
      prompt,
      model = "gpt-image-1", // default to latest model
      n = 1,
      quality = "auto",
      size = "auto",
      background = "auto",
      output_format = "png",
      output_compression = null,
      moderation = "auto",
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

    console.log(
      `🎨 OpenAI Image: Generate with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}"`,
    );

    // Prepare request body
    const requestBody: Record<string, any> = {
      prompt,
      model,
      n,
      quality,
      size,
      background,
      user: userId,
    };

    // Optional parameters
    if (output_format) requestBody.output_format = output_format;
    if (
      output_compression !== null &&
      (output_format === "jpeg" || output_format === "webp")
    ) {
      requestBody.output_compression = output_compression;
    }
    if (moderation) requestBody.moderation = moderation;

    // Send request to OpenAI API
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
    );

    // Handle API errors
    if (!openaiResponse.ok) {
      let errorData;
      let errorText;

      try {
        // First try to get the response as text
        errorText = await openaiResponse.text();

        // Try to parse as JSON with a proper try-catch
        try {
          errorData = JSON.parse(errorText);
        } catch (jsonError) {
          // Not valid JSON, use the text directly
          errorData = { message: errorText };
        }
      } catch (parseError) {
        // If even text() fails, provide a fallback
        console.error(
          `❌ OpenAI Image: Error parsing error response:`,
          parseError,
        );
        errorData = {
          message: `Failed to parse error response: ${parseError.message}`,
        };
      }

      console.error(`❌ OpenAI Image: Error generating image:`, errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to generate image",
          details: errorData,
        }),
        {
          status: openaiResponse.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Stream the response
    console.log(
      `✅ OpenAI Image: Successfully generated image - streaming response`,
    );

    // Create a stream for the response
    const { readable, writable } = new TransformStream();

    // Clone the response to avoid locking the body
    const clonedResponse = openaiResponse.clone();

    // Pipe the response body to our writable stream without awaiting
    clonedResponse.body.pipeTo(writable).catch((err) => {
      console.error(`❌ OpenAI Image: Pipe error:`, err);
    });

    // Return the stream immediately
    return new Response(readable, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(`❌ OpenAI Image: Error in generateImage:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

// Core function to edit images using OpenAI API
export async function editImage(
  c: HonoContext,
  params: ImageEditRequest,
  apiKey: string,
): Promise<Response> {
  console.log(
    `🖌️ OpenAI Image: Editing image, userId: ${params.userId || "anonymous"}`,
  );
  try {
    const {
      prompt,
      model = "gpt-image-1",
      n = 1,
      quality = "auto",
      size = "auto",
      background = "auto",
      output_format = "png",
      output_compression = null,
      moderation = "auto",
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

    // For image edits, we need to get the image data from FormData
    let imageData;
    let maskData = null;
    let multipleImages: ArrayBuffer[] = [];

    // Process form data to extract images
    const formData = await c.req.formData();
    for (const [name, value] of formData.entries()) {
      // Log the form field names we're receiving
      console.log(`📄 Image Form Field: ${name}`);

      if (name === "image" && value instanceof File) {
        imageData = await value.arrayBuffer();
      } else if (name === "mask" && value instanceof File) {
        maskData = await value.arrayBuffer();
      } else if (
        (name === "images[]" || name === "image[]") &&
        value instanceof File
      ) {
        // Multiple reference images
        multipleImages.push(await value.arrayBuffer());
      } else if (name.match(/^image_\d+$/) && value instanceof File) {
        // Handle indexed image format (image_0, image_1, etc.) from CallAI
        imageData = await value.arrayBuffer();
      }
    }

    if (!imageData && multipleImages.length === 0) {
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

    console.log(
      `🎨 OpenAI Image: Edit with prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}"`,
    );
    console.log(
      `📊 OpenAI Image: Edit with ${imageData ? "single image" : ""} ${maskData ? "and mask" : ""} ${multipleImages.length > 0 ? `and ${multipleImages.length} reference images` : ""}`,
    );

    // Prepare request body
    const formDataToSend = new FormData();
    formDataToSend.append("prompt", prompt);
    formDataToSend.append("model", model);
    formDataToSend.append("quality", quality);
    formDataToSend.append("size", size);
    formDataToSend.append("background", background);
    if (output_format) formDataToSend.append("output_format", output_format);
    if (
      output_compression !== null &&
      (output_format === "jpeg" || output_format === "webp")
    ) {
      formDataToSend.append(
        "output_compression",
        output_compression.toString(),
      );
    }
    if (moderation) formDataToSend.append("moderation", moderation);
    formDataToSend.append("user", userId);

    // Add images - handling both single image and multiple images cases
    if (multipleImages.length > 0) {
      // Multiple images case (like the gift basket example)
      multipleImages.forEach((imgBuffer, index) => {
        formDataToSend.append(
          "image",
          new Blob([imgBuffer], { type: "image/png" }),
          `image-${index}.png`,
        );
      });
    } else if (imageData) {
      // Single image case
      formDataToSend.append(
        "image",
        new Blob([imageData], { type: "image/png" }),
        "image.png",
      );

      if (maskData) {
        formDataToSend.append(
          "mask",
          new Blob([maskData], { type: "image/png" }),
          "mask.png",
        );
      }
    }

    // Log what we're sending to OpenAI
    console.log(
      `📤 OpenAI Image: Sending edit request with fields:`,
      [...formDataToSend.entries()].map((e) => e[0]),
    );

    // Send request to OpenAI API
    try {
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/images/edits",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formDataToSend,
        },
      );

      // Log response details
      console.log(
        `📥 OpenAI Image: Response status:`,
        openaiResponse.status,
        openaiResponse.statusText,
      );
      console.log(
        `📥 OpenAI Image: Response headers:`,
        Object.fromEntries(openaiResponse.headers.entries()),
      );

      // If there's an error from the OpenAI API, handle it
      if (!openaiResponse.ok) {
        let errorData;
        const contentType = openaiResponse.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          errorData = await openaiResponse.json();
        } else {
          // Handle non-JSON responses (like HTML)
          const textResponse = await openaiResponse.text();
          console.error(
            `❌ OpenAI Image: Non-JSON error response:`,
            textResponse.substring(0, 200),
          );
          errorData = {
            message: `Non-JSON response (${contentType}): ${textResponse.substring(0, 100)}...`,
          };
        }

        console.error(`❌ OpenAI Image: Error editing image:`, errorData);
        return new Response(
          JSON.stringify({
            error: "Failed to edit image",
            details: errorData,
          }),
          {
            status: openaiResponse.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      }

      // Stream the response efficiently
      console.log(
        `✅ OpenAI Image: Successfully edited image - streaming response`,
      );

      // Use native body with proper error handling
      const { readable, writable } = new TransformStream();

      // Clone the response to avoid locking the body
      const clonedResponse = openaiResponse.clone();

      // Process the response without awaiting
      clonedResponse.body.pipeTo(writable).catch((err) => {
        console.error(`❌ OpenAI Image: Pipe error:`, err);
      });

      // Return the stream immediately
      return new Response(readable, {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (streamError) {
      console.error(
        `❌ OpenAI Image: Error in streaming edited image:`,
        streamError,
      );
      return new Response(JSON.stringify({ error: streamError.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch (error) {
    console.error(`❌ OpenAI Image: Error in editImage:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

// Hono compatible OpenAI Image Generator route
export class ImageGenerate extends OpenAPIRoute {
  schema = {
    tags: ["OpenAI"],
    summary: "Generate images using OpenAI",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              prompt: z.string().describe("The image generation prompt"),
              model: z
                .string()
                .optional()
                .default("gpt-image-1")
                .describe("The model to use"),
              n: z
                .number()
                .optional()
                .default(1)
                .describe("Number of images to generate"),
              quality: z
                .string()
                .optional()
                .default("auto")
                .describe("Image quality: auto, low, medium, high"),
              size: z
                .string()
                .optional()
                .default("auto")
                .describe("Image size: auto, 1024x1024, etc."),
              background: z
                .string()
                .optional()
                .default("auto")
                .describe("Background style: auto, transparent, opaque"),
              output_format: z
                .string()
                .optional()
                .default("png")
                .describe("Output format: png, jpeg, webp"),
              output_compression: z
                .number()
                .nullable()
                .optional()
                .describe("Compression level for jpeg/webp (0-100)"),
              moderation: z
                .string()
                .optional()
                .default("auto")
                .describe("Moderation level: auto, low"),
              userId: z
                .string()
                .optional()
                .describe("User ID for API billing and tracking"),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Returns the generated image data",
        content: {
          "application/json": {
            schema: z.object({
              created: z.number(),
              data: z.array(
                z.object({
                  url: z.string().optional(),
                  b64_json: z.string().optional(),
                  revised_prompt: z.string().optional(),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c) {
    try {
      // Get validated request data from JSON body
      const data = await c.req.json();

      // Convert the data to our type
      const requestBody: ImageGenerateRequest = {
        prompt: data.prompt,
        model: data.model || "gpt-image-1",
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
        userId: data.userId || "anonymous",
      };

      // Get the OpenAI API key from env
      const apiKey = c.env.OPENAI_API_KEY;
      if (!apiKey) {
        return c.json({ error: "OpenAI API key not configured" }, 500);
      }

      // Call the core function to generate image
      const response = await generateImage(requestBody, apiKey);

      // Return the streaming response
      return response;
    } catch (error) {
      console.error("Error in ImageGenerate handler:", error);
      return c.json(
        { error: error.message || "An error occurred processing your request" },
        500,
      );
    }
  }
}

// Hono compatible OpenAI Image Editor route
export class ImageEdit extends OpenAPIRoute {
  schema = {
    tags: ["OpenAI"],
    summary: "Edit images using OpenAI",
    request: {
      body: {
        content: {
          "multipart/form-data": {
            schema: z.object({
              prompt: z.string().describe("The image editing prompt"),
              image: z.any().describe("The image to edit"),
              mask: z
                .any()
                .optional()
                .describe("Optional mask for editing specific areas"),
              model: z
                .string()
                .optional()
                .default("gpt-image-1")
                .describe("The model to use"),
              n: z
                .number()
                .optional()
                .default(1)
                .describe("Number of images to generate"),
              quality: z
                .string()
                .optional()
                .default("auto")
                .describe("Image quality: auto, low, medium, high"),
              size: z
                .string()
                .optional()
                .default("auto")
                .describe("Image size: auto, 1024x1024, etc."),
              background: z
                .string()
                .optional()
                .default("auto")
                .describe("Background style: auto, transparent, opaque"),
              output_format: z
                .string()
                .optional()
                .default("png")
                .describe("Output format: png, jpeg, webp"),
              output_compression: z
                .number()
                .nullable()
                .optional()
                .describe("Compression level for jpeg/webp (0-100)"),
              moderation: z
                .string()
                .optional()
                .default("auto")
                .describe("Moderation level: auto, low"),
              userId: z
                .string()
                .optional()
                .describe("User ID for API billing and tracking"),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Returns the edited image data",
        content: {
          "application/json": {
            schema: z.object({
              created: z.number(),
              data: z.array(
                z.object({
                  url: z.string().optional(),
                  b64_json: z.string().optional(),
                  revised_prompt: z.string().optional(),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c) {
    try {
      // For the edit route, we'll create an empty request object first
      const requestBody: ImageEditRequest = {
        prompt: "",
        userId: "anonymous",
      };

      // We'll extract the prompt and other scalar parameters from the formData
      const formData = await c.req.formData();

      // Extract text parameters from formData
      requestBody.prompt = formData.get("prompt")?.toString() || "";
      requestBody.model = formData.get("model")?.toString() || "gpt-image-1";
      requestBody.n = parseInt(formData.get("n")?.toString() || "1", 10);
      requestBody.quality = formData.get("quality")?.toString() || "auto";
      requestBody.size = formData.get("size")?.toString() || "auto";
      requestBody.background = formData.get("background")?.toString() || "auto";
      requestBody.output_format =
        formData.get("output_format")?.toString() || "png";

      // Handle output_compression which can be null
      const output_compression_str = formData
        .get("output_compression")
        ?.toString();
      requestBody.output_compression = output_compression_str
        ? parseInt(output_compression_str, 10)
        : null;

      requestBody.moderation = formData.get("moderation")?.toString() || "auto";
      requestBody.userId = formData.get("userId")?.toString() || "anonymous";

      // Get the OpenAI API key from env
      const apiKey = c.env.OPENAI_API_KEY;
      if (!apiKey) {
        return c.json({ error: "OpenAI API key not configured" }, 500);
      }

      // Call the core function to edit image
      // We pass the context object so we can access form data with image files
      const response = await editImage(c, requestBody, apiKey);

      // Return the streaming response
      return response;
    } catch (error) {
      console.error("Error in ImageEdit handler:", error);
      return c.json(
        { error: error.message || "An error occurred processing your request" },
        500,
      );
    }
  }
}
