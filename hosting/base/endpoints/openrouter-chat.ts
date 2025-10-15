import { OpenAPIRoute, contentJson } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

// OpenRouter chat completion endpoint
export class OpenRouterChat extends OpenAPIRoute {
  schema = {
    tags: ["OpenRouter"],
    summary: "Chat completions via OpenRouter API",
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

      // Get user from context (set by auth middleware from X-VIBES-Token)
      const user = c.get("user");
      const userId = user?.userId;

      // Get client IP for logging
      const clientIp = c.req.header("cf-connecting-ip") ?? "";

      // Check for Bearer token (BYOK - bring your own key)
      const authHeader = c.req.header("Authorization");
      let apiKey: string;
      let _isUserProvidedKey = false;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const providedKey = authHeader.substring(7);

        // Check if it's the dummy key indicating proxy-managed authentication
        if (providedKey === "sk-vibes-proxy-managed") {
          // Require authentication for proxy-managed API key usage
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

          // Use server's OpenRouter key
          apiKey = c.env.SERVER_OPENROUTER_API_KEY;
          if (!apiKey) {
            return c.json({ error: "OpenRouter API key not configured" }, 500);
          }
          console.log(
            `🔑 OpenRouter Chat: User ${userId || "anonymous"} (IP: ${clientIp}) using proxy-managed API key`,
          );
        } else {
          // User is providing their own OpenRouter key
          apiKey = providedKey;
          _isUserProvidedKey = true;
          console.log(
            `🔑 OpenRouter Chat: User ${userId || "anonymous"} (IP: ${clientIp}) using their own API key`,
          );
        }
      } else {
        // No authorization header - require it
        return c.json({ error: "Authorization header required" }, 401);
      }

      console.log(
        `🤖 OpenRouter Chat: Processing request for user ${userId || "anonymous"} (IP: ${clientIp}), model: ${data.model}`,
      );

      // Add OpenRouter specific headers
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": c.req.header("Referer") || "https://vibesdiy.app",
        "X-Title": "Vibes DIY",
      };

      // Send request to OpenRouter API
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        },
      );

      // Handle streaming responses if requested
      if (data.stream) {
        console.log(`🔄 OpenRouter Chat: Streaming response`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`❌ OpenRouter Chat: Error:`, errorData);
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

        // Create a stream for the response
        const { readable, writable } = new TransformStream();

        // Clone the response to avoid locking the body
        const clonedResponse = response.clone();

        // Pipe the response body to our writable stream without awaiting
        clonedResponse.body?.pipeTo(writable).catch((err) => {
          console.error(`❌ OpenRouter Chat: Pipe error:`, err);
        });

        // Return the stream immediately
        return new Response(readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Handle API errors
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ OpenRouter Chat: Error:`, errorData);
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
      console.log(`✅ OpenRouter Chat: Successfully processed request`);

      const responseData = await response.json();

      return c.json(responseData);
    } catch (error: unknown) {
      console.error("Error in OpenRouterChat handler:", error);
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
