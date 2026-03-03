export interface SchemaInput {
  readonly name?: string;
  readonly properties: Record<string, unknown>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
}

interface ChatMessage {
  readonly role: string;
  readonly content: string | readonly { readonly type: string; readonly text: string }[];
}

interface ResponseFormat {
  readonly type: "json_schema";
  readonly json_schema: {
    readonly name: string;
    readonly strict: true;
    readonly schema: {
      readonly type: "object";
      readonly properties: Record<string, unknown>;
      readonly required: readonly string[];
      readonly additionalProperties: boolean;
    };
  };
}

interface AnthropicTool {
  readonly name: string;
  readonly description: string;
  readonly input_schema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required: readonly string[];
    readonly additionalProperties: boolean;
  };
}

interface AnthropicToolChoice {
  readonly type: "tool";
  readonly name: string;
}

export interface RequestBody {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly stream: true;
  readonly response_format?: ResponseFormat;
  readonly tools?: readonly AnthropicTool[];
  readonly tool_choice?: AnthropicToolChoice;
  readonly max_tokens?: number;
}

export interface BuildRequestParams {
  readonly model: string;
  readonly prompt: string;
  readonly schema?: SchemaInput;
  readonly apiStyle?: "openai" | "anthropic";
  readonly url?: string;
}

function detectApiStyle(url?: string): "openai" | "anthropic" {
  if (url !== undefined) {
    try {
      const hostname = new URL(url).hostname;
      if (hostname === "api.anthropic.com") {
        return "anthropic";
      }
    } catch {
      // invalid URL, fall through to default
    }
  }
  return "openai";
}

export function buildRequestBody({ model, prompt, schema, apiStyle, url }: BuildRequestParams): RequestBody {
  const style = apiStyle !== undefined ? apiStyle : detectApiStyle(url);

  if (style === "anthropic" && schema !== undefined) {
    const name = schema.name !== undefined ? schema.name : "result";
    const required = schema.required !== undefined ? [...schema.required] : Object.keys(schema.properties);
    const additionalProperties = schema.additionalProperties !== undefined ? schema.additionalProperties : false;

    return {
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      max_tokens: 1024,
      tools: [{
        name,
        description: "Return structured JSON",
        input_schema: {
          type: "object",
          properties: schema.properties,
          required,
          additionalProperties,
        },
      }],
      tool_choice: { type: "tool", name },
    };
  }

  const systemMessages: readonly ChatMessage[] = schema
    ? [{ role: "system", content: [{ type: "text", text: `Return a JSON object conforming to this schema: ${JSON.stringify(schema)}` }] }]
    : [];

  const messages: readonly ChatMessage[] = [
    ...systemMessages,
    { role: "user", content: prompt },
  ];

  const responseFormat: ResponseFormat | undefined = schema
    ? {
        type: "json_schema",
        json_schema: {
          name: schema.name !== undefined ? schema.name : "result",
          strict: true,
          schema: {
            type: "object",
            properties: schema.properties,
            required: schema.required !== undefined ? [...schema.required] : Object.keys(schema.properties),
            additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : false,
          },
        },
      }
    : undefined;

  return responseFormat !== undefined
    ? { model, messages, stream: true, response_format: responseFormat }
    : { model, messages, stream: true };
}
