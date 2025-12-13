import { OpenAPIRoute, contentJson } from "chanfana";
import { Context } from "hono";
import { z } from "zod";
import {
  checkBudget,
  getUserTier,
  getUserUsage,
  TIER_LIMITS,
} from "../services/rate-limiter.js";
import { createIdExtractorStream } from "../utils/streaming-id-extractor.js";

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

      // Require authentication for OpenRouter API usage
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

      const userId = user.userId;

      // Check burst rate limit (200 requests per minute per user)
      if (c.env.BURST_LIMITER) {
        const { success } = await c.env.BURST_LIMITER.limit({ key: userId });
        if (!success) {
          return c.json(
            {
              error: {
                message: "Too many requests. Please slow down.",
                type: "rate_limit_error",
                code: 429,
              },
            },
            429,
          );
        }
      }

      // Check budget limits based on user tier
      const tier = getUserTier(user);
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
      const budgetResult = await checkBudget(c.env.KV, userId, limits);

      if (!budgetResult.allowed) {
        const resetTime =
          budgetResult.reason === "daily_exceeded"
            ? "midnight UTC"
            : "the start of next month";
        const limitType =
          budgetResult.reason === "daily_exceeded" ? "Daily" : "Monthly";
        const limitAmount =
          budgetResult.reason === "daily_exceeded"
            ? limits.daily
            : limits.monthly;
        const usedAmount =
          budgetResult.reason === "daily_exceeded"
            ? budgetResult.usage.daily
            : budgetResult.usage.monthly;

        return c.json(
          {
            error: {
              message: `${limitType} budget exceeded. Budget: $${limitAmount.toFixed(2)}, Used: $${usedAmount.toFixed(2)}. Resets at ${resetTime}.`,
              type: "rate_limit_error",
              code: 429,
              usage: {
                daily: {
                  limit: limits.daily,
                  used: budgetResult.usage.daily,
                  currency: "USD",
                },
                monthly: {
                  limit: limits.monthly,
                  used: budgetResult.usage.monthly,
                  currency: "USD",
                },
              },
            },
          },
          429,
        );
      }

      // Always use server's OpenRouter API key
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

      // Add OpenRouter specific headers
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": c.req.header("Referer") || "https://vibesdiy.app",
        "X-Title": "Vibes DIY",
      };

      // Get current usage for response headers
      const currentUsage = await getUserUsage(c.env.KV, userId);

      // Helper to add rate limit headers
      const rateLimitHeaders = {
        "X-RateLimit-Daily-Limit": limits.daily.toString(),
        "X-RateLimit-Daily-Used": currentUsage.daily.toFixed(4),
        "X-RateLimit-Daily-Remaining": Math.max(
          0,
          limits.daily - currentUsage.daily,
        ).toFixed(4),
        "X-RateLimit-Monthly-Limit": limits.monthly.toString(),
        "X-RateLimit-Monthly-Used": currentUsage.monthly.toFixed(4),
        "X-RateLimit-Monthly-Remaining": Math.max(
          0,
          limits.monthly - currentUsage.monthly,
        ).toFixed(4),
      };

      // Send request to OpenRouter API with user tracking
      // See: https://openrouter.ai/docs/guides/guides/user-tracking
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ ...data, user: userId }),
        },
      );

      // Handle streaming responses if requested
      if (data.stream) {
        if (!response.ok) {
          const errorData = await response.json();
          console.error(`OpenRouter Chat: Error:`, errorData);
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
                ...rateLimitHeaders,
              },
            },
          );
        }

        // Create ID extractor stream to capture generation ID for usage tracking
        const idExtractorStream = createIdExtractorStream((id: string) => {
          // Queue usage tracking message
          if (c.env.USAGE_QUEUE) {
            c.env.USAGE_QUEUE.send({ userId, generationId: id }).catch(
              (err: unknown) =>
                console.error(`Failed to queue usage tracking:`, err),
            );
          }
        });

        // Clone the response to avoid locking the body
        const clonedResponse = response.clone();

        // Pipe through the ID extractor stream
        if (clonedResponse.body) {
          clonedResponse.body
            .pipeThrough(idExtractorStream)
            .pipeTo(new WritableStream())
            .catch((err) => {
              console.error(`OpenRouter Chat: ID extraction error:`, err);
            });
        }

        // Return the original response stream (ID extractor runs in parallel)
        return new Response(response.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            ...rateLimitHeaders,
          },
        });
      }

      // Handle API errors
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`OpenRouter Chat: Error:`, errorData);
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
              ...rateLimitHeaders,
            },
          },
        );
      }

      // For non-streaming responses, pass through the original response
      const responseData = (await response.json()) as { id?: string };

      // Queue usage tracking for non-streaming responses
      if (responseData.id && c.env.USAGE_QUEUE) {
        await c.env.USAGE_QUEUE.send({
          userId,
          generationId: responseData.id,
        });
      }

      // Add rate limit headers to the response
      return new Response(JSON.stringify(responseData), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          ...rateLimitHeaders,
        },
      });
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
