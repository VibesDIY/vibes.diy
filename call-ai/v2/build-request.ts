import { URI } from "@adviser/cement";

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
  readonly apiStyle?: ApiStyle;
  readonly url?: string;
}

export type ApiStyle = "openai" | "anthropic";

export function getHeaders(apiStyle: ApiStyle, apiKey: string): Record<string, string> {
  if (apiStyle === "anthropic") {
    return {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export function resolveApiStyle(url?: string, apiStyle?: ApiStyle): ApiStyle {
  if (apiStyle !== undefined) {
    return apiStyle;
  }

  if (url !== undefined && URI.from(url).hostname === "api.anthropic.com") {
    return "anthropic";
  }
  return "openai";
}

interface NormalizedSchema {
  readonly name: string;
  readonly schema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required: readonly string[];
    readonly additionalProperties: boolean;
  };
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

function normalizeSchema(schema: SchemaInput): NormalizedSchema {
  return {
    name: schema.name !== undefined ? schema.name : "result",
    schema: {
      type: "object",
      properties: processProperties(schema.properties),
      required: schema.required !== undefined ? [...schema.required] : Object.keys(schema.properties),
      additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : false,
    },
  };
}

export function buildRequestBody({ model, prompt, schema, apiStyle, url }: BuildRequestParams): RequestBody {
  const style = resolveApiStyle(url, apiStyle);

  if (style === "anthropic") {
    const anthropicBody: RequestBody = {
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
      max_tokens: 1024,
    };

    if (schema === undefined) {
      return anthropicBody;
    }

    const normalized = normalizeSchema(schema);
    return {
      ...anthropicBody,
      tools: [{
        name: normalized.name,
        description: "Return structured JSON",
        input_schema: normalized.schema,
      }],
      tool_choice: { type: "tool", name: normalized.name },
    };
  }

  if (schema === undefined) {
    return {
      model,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    };
  }

  const normalized = normalizeSchema(schema);
  const systemMessages: readonly ChatMessage[] = [
    {
      role: "system",
      content: [{ type: "text", text: `Return a JSON object conforming to this schema: ${JSON.stringify(schema)}` }],
    },
  ];

  const messages: readonly ChatMessage[] = [
    ...systemMessages,
    { role: "user", content: prompt },
  ];

  const responseFormat: ResponseFormat = {
    type: "json_schema",
    json_schema: {
      name: normalized.name,
      strict: true,
      schema: normalized.schema,
    },
  };

  return { model, messages, stream: true, response_format: responseFormat };
}
