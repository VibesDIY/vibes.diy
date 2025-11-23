import { OpenAPIRoute, contentJson } from "chanfana";
import { Context } from "hono";
import { z } from "zod";

// TypeScript interfaces for Claude API requests
export interface ClaudeMessage {
  role: string;
  content: string;
}

export interface ClaudeMessagesRequest {
  model: string;
  messages: {
    role: string;
    content: string;
  }[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stream?: boolean;
  user?: string;
}

// Interface for Claude API response
export interface ClaudeMessagesResponse {
  id: string;
  type: string;
  model: string;
  content: {
    type: string;
    text?: string;
  }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// Function to convert OpenAI format messages to Claude format
function convertToClaudeFormat(messages: { role: string; content: string }[]): {
  systemPrompt: string | null;
  claudeMessages: { role: string; content: string }[];
} {
  let systemPrompt: string | null = null;
  const claudeMessages: { role: string; content: string }[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      // Claude uses a separate system parameter rather than including it in messages
      systemPrompt = message.content;
    } else {
      // Map OpenAI roles to Claude roles
      let claudeRole = message.role;
      if (message.role === "assistant") {
        claudeRole = "assistant";
      } else if (message.role === "user") {
        claudeRole = "user";
      }

      claudeMessages.push({
        role: claudeRole,
        content: message.content,
      });
    }
  }

  return { systemPrompt, claudeMessages };
}

// Function to convert Claude API response to OpenAI format
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function convertToOpenAIFormat(
  claudeResponse: ClaudeMessagesResponse,
): OpenAIResponse {
  // Extract text content from Claude response
  const content = claudeResponse.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("");

  return {
    id: claudeResponse.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: claudeResponse.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: claudeResponse.usage.input_tokens,
      completion_tokens: claudeResponse.usage.output_tokens,
      total_tokens:
        claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens,
    },
  };
}

// Core function to handle chat completions via Claude API
export async function claudeChat(
  params: ClaudeMessagesRequest,
  apiKey: string,
): Promise<Response> {
  try {
    const { systemPrompt, claudeMessages } = convertToClaudeFormat(
      params.messages,
    );

    // Prepare Claude API request body
    const requestBody: {
      model: string;
      messages: ClaudeMessage[];
      max_tokens?: number;
      temperature?: number;
      top_p?: number;
      top_k?: number;
      stream?: boolean;
      system?: string;
      user?: string;
    } = {
      model: params.model,
      messages: claudeMessages,
      max_tokens: params.max_tokens || 1024,
      temperature: params.temperature,
      top_p: params.top_p,
      top_k: params.top_k,
      stream: params.stream,
    };

    // Add system prompt if present
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    // Add user identifier if provided
    if (params.user) {
      requestBody.user = params.user;
    }

    // Send request to Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });

    // Handle streaming responses
    if (params.stream) {
      // Create a transformer to convert Claude stream format to OpenAI format
      const transformStream = new TransformStream({
        start(_controller) {
          // Stream transformation start - intentionally empty
        },
        async transform(chunk, controller) {
          try {
            // Parse the chunk and convert to OpenAI format
            const text = new TextDecoder().decode(chunk);

            if (text.trim() === "") return;

            // Handle the Claude event format
            if (text.startsWith("event:") || text.startsWith("data:")) {
              const lines = text.split("\n");
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  const data = line.slice(5).trim();
                  if (data === "[DONE]") {
                    controller.enqueue(
                      new TextEncoder().encode(`data: [DONE]\n\n`),
                    );
                    return;
                  }

                  try {
                    const claudeEvent = JSON.parse(data);

                    // Convert to OpenAI format
                    const openaiEvent = {
                      id: claudeEvent.id || `chatcmpl-${Date.now()}`,
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model: claudeEvent.model,
                      choices: [] as {
                        index: number;
                        delta: { content?: string };
                        finish_reason: string | null;
                      }[],
                    };

                    if (
                      claudeEvent.type === "content_block_delta" &&
                      claudeEvent.delta.type === "text"
                    ) {
                      openaiEvent.choices.push({
                        index: 0,
                        delta: { content: claudeEvent.delta.text },
                        finish_reason: null,
                      });
                    } else if (claudeEvent.type === "message_stop") {
                      openaiEvent.choices.push({
                        index: 0,
                        delta: {},
                        finish_reason: "stop",
                      });
                    }

                    controller.enqueue(
                      new TextEncoder().encode(
                        `data: ${JSON.stringify(openaiEvent)}\n\n`,
                      ),
                    );
                  } catch (e) {
                    console.error("Error parsing Claude event:", e);
                  }
                }
              }
            }
          } catch (error) {
            console.error("Error in stream transform:", error);
          }
        },
      });

      // Create a readable stream to pipe to transformer
      const { readable, writable } = new TransformStream();

      // Clone response and pipe to transformer
      const clonedResponse = response.clone();
      if (clonedResponse.body) {
        const reader = clonedResponse.body.getReader();

        // Read and process the response body
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              await transformStream.writable.getWriter().write(value);
            }
            await transformStream.writable.getWriter().close();
          } catch (error) {
            console.error("Error reading response body:", error);
            transformStream.writable.getWriter().abort(error);
          }
        })();

        // Pipe the transformed stream to our writable
        transformStream.readable.pipeTo(writable).catch((error) => {
          console.error("Error piping stream:", error);
        });
      }

      // Return the stream
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Handle API errors
    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: "Failed to parse error response" };
      }

      console.error(`❌ Claude API: Error:`, errorData);
      return new Response(
        JSON.stringify({
          error: {
            message: "Failed to get response from Claude",
            type: "api_error",
            param: null,
            code: response.status,
            details: errorData,
          },
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

    // For non-streaming responses, convert from Claude to OpenAI format
    const claudeData = (await response.json()) as ClaudeMessagesResponse;
    const openAIFormat = convertToOpenAIFormat(claudeData);

    return new Response(JSON.stringify(openAIFormat), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: unknown) {
    console.error(`❌ Claude API: Error in claudeChat:`, error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : String(error),
          type: "server_error",
          param: null,
          code: null,
        },
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

// Hono compatible Claude Chat endpoint that maintains OpenAI compatibility
export class ClaudeChat extends OpenAPIRoute {
  schema = {
    tags: ["Claude"],
    summary: "Chat completions via Claude API with OpenAI-compatible interface",
    request: {
      body: contentJson(
        z.object({
          model: z
            .string()
            .describe(
              "ID of the Claude model to use (e.g., 'claude-3-opus-20240229')",
            ),
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
            .describe("Sampling temperature (0-1)"),
          top_p: z
            .number()
            .optional()
            .default(1)
            .describe("Nucleus sampling parameter"),
          top_k: z
            .number()
            .optional()
            .describe(
              "Only sample from the top K options for each subsequent token",
            ),
          max_tokens: z
            .number()
            .optional()
            .default(1024)
            .describe("Maximum number of tokens to generate"),
          stream: z
            .boolean()
            .optional()
            .default(false)
            .describe("Stream partial progress"),
          user: z.string().optional().describe("User ID for tracking"),
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
      // Get request data from JSON body
      const data = await c.req.json();

      // Require authentication for Claude API usage
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

      // Convert the data to our type
      const requestBody: ClaudeMessagesRequest = {
        model: data.model,
        messages: data.messages,
        max_tokens: data.max_tokens,
        temperature: data.temperature,
        top_p: data.top_p,
        top_k: data.top_k,
        stream: data.stream,
        user: data.user,
      };

      // Get the Claude API key from env
      const apiKey = c.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return c.json(
          {
            error: {
              message: "Claude API key not configured",
              type: "server_error",
              param: null,
              code: null,
            },
          },
          500,
        );
      }

      // Call the core function for chat completion
      const response = await claudeChat(requestBody, apiKey);

      // Return the response (may be streaming or regular JSON)
      return response;
    } catch (error: unknown) {
      console.error("Error in ClaudeChat handler:", error);
      return c.json(
        {
          error: {
            message:
              error instanceof Error
                ? error.message
                : "An error occurred processing your request",
            type: "server_error",
            param: null,
            code: null,
          },
        },
        500,
      );
    }
  }
}
