import { OpenAPIRoute, contentJson } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

// TypeScript interfaces for OpenAI Chat API requests
export interface ChatCompletionRequest {
  model: string;
  messages: {
    role: string;
    content: string;
    name?: string;
  }[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  response_format?: {
    type: string;
  };
  seed?: number;
}

// Core function to handle chat completions via OpenAI API
export async function chatCompletion(
  params: ChatCompletionRequest,
  apiKey: string,
): Promise<Response> {
  // Normalize model ID - remove 'openai/' prefix if present
  if (params.model && params.model.startsWith("openai/")) {
    params.model = params.model.replace("openai/", "");
  }

  console.log(`🤖 OpenAI Chat: Processing request, model: ${params.model}`);

  try {
    const requestBody = { ...params };

    // Send request to OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    // Handle streaming responses if requested
    if (params.stream) {
      console.log(`🔄 OpenAI Chat: Streaming response`);
      // Create a stream for the response
      const { readable, writable } = new TransformStream();

      // Clone the response to avoid locking the body
      const clonedResponse = response.clone();

      // Pipe the response body to our writable stream without awaiting
      clonedResponse.body?.pipeTo(writable).catch((err) => {
        console.error(`❌ OpenAI Chat: Pipe error:`, err);
      });

      // Return the stream immediately
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Handle API errors
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`❌ OpenAI Chat: Error:`, errorData);
      return new Response(
        JSON.stringify({
          error: "Failed to get chat completion",
          details: errorData,
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // For non-streaming responses, pass through the original response
    console.log(`✅ OpenAI Chat: Successfully processed request`);

    const responseData = await response.json();

    return new Response(JSON.stringify(responseData), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: unknown) {
    console.error(`❌ OpenAI Chat: Error in chatCompletion:`, error);
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

// Hono compatible OpenAI Chat endpoint
export class ChatComplete extends OpenAPIRoute {
  schema = {
    tags: ["OpenAI"],
    summary: "Chat completions via OpenAI API",
    request: {
      body: contentJson(
        z.object({
          model: z.string().describe("ID of the model to use"),
          messages: z
            .array(
              z.object({
                role: z
                  .string()
                  .describe(
                    "The role of the message author (system, user, assistant)",
                  ),
                content: z.string().describe("The content of the message"),
                name: z
                  .string()
                  .optional()
                  .describe("Optional name for the message author"),
              }),
            )
            .describe("A list of messages comprising the conversation so far"),
          temperature: z
            .number()
            .optional()
            .default(1)
            .describe("Sampling temperature (0-2)"),
          top_p: z
            .number()
            .optional()
            .default(1)
            .describe("Nucleus sampling parameter"),
          n: z
            .number()
            .optional()
            .default(1)
            .describe("Number of chat completion choices to generate"),
          stream: z
            .boolean()
            .optional()
            .default(false)
            .describe("Stream partial progress"),
          max_tokens: z
            .number()
            .optional()
            .describe("Maximum number of tokens to generate"),
          presence_penalty: z
            .number()
            .optional()
            .default(0)
            .describe("Presence penalty for token selection"),
          frequency_penalty: z
            .number()
            .optional()
            .default(0)
            .describe("Frequency penalty for token selection"),
          logit_bias: z
            .record(z.string(), z.number())
            .optional()
            .describe("Modify likelihood of specific tokens"),
          user: z
            .string()
            .optional()
            .describe("User ID for billing and tracking"),
          response_format: z
            .object({
              type: z
                .string()
                .describe("Format of the response (json or text)"),
            })
            .optional()
            .describe("Format of the response"),
          seed: z
            .number()
            .optional()
            .describe("Seed for deterministic sampling"),
        }),
      ),
    },
    responses: {
      200: {
        description: "Successful chat completion",
        ...contentJson(
          z.object({
            id: z.string(),
            object: z.string(),
            created: z.number(),
            model: z.string(),
            choices: z.array(
              z.object({
                index: z.number(),
                message: z.object({
                  role: z.string(),
                  content: z.string(),
                }),
                finish_reason: z.string(),
              }),
            ),
            usage: z.object({
              prompt_tokens: z.number(),
              completion_tokens: z.number(),
              total_tokens: z.number(),
            }),
          }),
        ),
      },
    },
  };

  async handle(c: Context) {
    try {
      // Get validated request data from JSON body
      const data = await c.req.json();

      // Convert the data to our type
      let modelId = data.model;

      // Normalize model ID - remove 'openai/' prefix if present (handle at both layers)
      if (
        modelId &&
        typeof modelId === "string" &&
        modelId.startsWith("openai/")
      ) {
        modelId = modelId.replace("openai/", "");
      }

      const requestBody: ChatCompletionRequest = {
        model: modelId,
        messages: data.messages,
        temperature: data.temperature,
        top_p: data.top_p,
        n: data.n,
        stream: data.stream,
        max_tokens: data.max_tokens,
        presence_penalty: data.presence_penalty,
        frequency_penalty: data.frequency_penalty,
        logit_bias: data.logit_bias,
        user: data.user,
        response_format: data.response_format,
        seed: data.seed,
      };

      // Get the OpenAI API key from env
      const apiKey = c.env.OPENAI_API_KEY;
      if (!apiKey) {
        return c.json({ error: "OpenAI API key not configured" }, 500);
      }

      // Call the core function for chat completion
      const response = await chatCompletion(requestBody, apiKey);

      // Return the response (may be streaming or regular JSON)
      return response;
    } catch (error: unknown) {
      console.error("Error in ChatComplete handler:", error);
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
