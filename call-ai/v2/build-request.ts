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

function processProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const prop = value as Record<string, unknown>;
      if (prop.type === "object" && prop.properties) {
        const nested = prop.properties as Record<string, unknown>;
        result[key] = {
          ...prop,
          properties: processProperties(nested),
          required: prop.required ?? Object.keys(nested),
          additionalProperties: prop.additionalProperties ?? false,
        };
      } else if (prop.type === "array" && prop.items && typeof prop.items === "object") {
        const items = prop.items as Record<string, unknown>;
        if (items.type === "object" && items.properties) {
          const nested = items.properties as Record<string, unknown>;
          result[key] = {
            ...prop,
            items: {
              ...items,
              properties: processProperties(nested),
              required: items.required ?? Object.keys(nested),
              additionalProperties: items.additionalProperties ?? false,
            },
          };
        } else {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    } else {
      result[key] = value;
    }
  }
  return result;
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
          properties: processProperties(schema.properties),
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
            properties: processProperties(schema.properties),
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
