/**
 * Model strategies for different AI models
 */
import {
  isToolUseType,
  Message,
  ModelStrategy,
  OpenAIFunctionCall,
  ProcessedSchema,
  SchemaAIJsonSchemaRequest,
  SchemaDescription,
  SchemaType,
} from "../types.js";
import { recursivelyAddAdditionalProperties } from "../utils.js";

/**
 * OpenAI/GPT strategy for handling JSON schema
 */
export const openAIStrategy: ModelStrategy = {
  name: "openai",
  prepareRequest: (schema) => {
    if (!schema) throw new Error("Schema strategy not implemented");

    // Process schema for JSON schema approach
    const requiredFields = schema.required || Object.keys(schema.properties || {});

    const processedSchema = recursivelyAddAdditionalProperties({
      type: "object",
      properties: schema.properties || {},
      required: requiredFields,
      additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : false,
      // Copy any additional schema properties
      ...Object.fromEntries(
        Object.entries(schema).filter(([key]) => !["name", "properties", "required", "additionalProperties"].includes(key)),
      ),
    });

    return {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schema.name || "result",
          strict: true,
          schema: processedSchema,
        },
      },
    } satisfies SchemaAIJsonSchemaRequest;
  },
  processResponse: (content) => {
    if (typeof content !== "string") {
      return JSON.stringify(content);
    }
    return content;
  },
};

/**
 * Gemini strategy for handling JSON schema (similar to OpenAI)
 */
export const geminiStrategy: ModelStrategy = {
  name: "gemini",
  prepareRequest: openAIStrategy.prepareRequest,
  processResponse: (content) => {
    if (typeof content !== "string") {
      return JSON.stringify(content);
    }

    // Try to extract JSON from content if it might be wrapped
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);

    if (jsonMatch && jsonMatch[1] !== undefined) {
      return jsonMatch[1];
    }
    return content;
  },
};

/**
 * Claude strategy using tool mode for structured output
 */
export const claudeStrategy: ModelStrategy = {
  name: "anthropic",
  shouldForceStream: true,
  prepareRequest: (schema) => {
    if (!schema) throw new Error("Schema strategy not implemented");

    // Process schema for tool use - format for OpenRouter/Claude
    const processedSchema = {
      type: "object",
      properties: schema.properties || {},
      required: schema.required || Object.keys(schema.properties || {}),
      additionalProperties: schema.additionalProperties !== undefined ? schema.additionalProperties : false,
    } satisfies ProcessedSchema;

    return {
      tools: [
        {
          type: "function",
          function: {
            name: schema.name || "generate_structured_data",
            description: "Generate data according to the required schema",
            parameters: processedSchema,
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: {
          name: schema.name || "generate_structured_data",
        },
      } satisfies OpenAIFunctionCall,
    };
  },
  processResponse: (content) => {
    // Handle tool use response
    if (isToolUseType(content)) {
      if (content.type === "tool_use") {
        return JSON.stringify(content.input);
      }

      // Handle newer tool_calls format
      if (content.tool_calls && Array.isArray(content.tool_calls) && content.tool_calls.length > 0) {
        const toolCall = content.tool_calls[0];
        if (toolCall.function && toolCall.function.arguments) {
          // @jchris i don't get this lines
          // try {
          //   // Try to parse as JSON first
          //   return toolCall.function.arguments;
          // } catch (e) {
          //   // Return as is if not valid JSON
          return JSON.stringify(toolCall.function.arguments);
          // }
        }
      }

      return JSON.stringify(content);
    }

    if (typeof content !== "string") {
      return JSON.stringify(content);
    }

    // Try to extract JSON from content if it might be wrapped
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);

    if (jsonMatch && jsonMatch[1] !== undefined) {
      return jsonMatch[1];
    }
    return content;
  },
};

/**
 * System message approach for other models (Llama, DeepSeek, etc.)
 */
export const systemMessageStrategy: ModelStrategy = {
  name: "system_message",
  prepareRequest: (schema, messages) => {
    if (!schema) return { messages };

    // Check if there's already a system message
    const hasSystemMessage = messages.some((m) => m.role === "system");

    if (!hasSystemMessage) {
      // Build a schema description
      const schemaProperties = Object.entries(schema.properties || {})
        .map(([key, value]) => {
          const type = (value as SchemaType).type || "string";
          const description = (value as SchemaDescription).description ? ` // ${(value as SchemaDescription).description}` : "";
          return `  "${key}": ${type}${description}`;
        })
        .join(",\n");

      const systemMessage: Message = {
        role: "system",
        content: `Please return your response as JSON following this schema exactly:\n{\n${schemaProperties}\n}\nDo not include any explanation or text outside of the JSON object.`,
      };

      // Return modified messages array with system message prepended
      return { messages: [systemMessage, ...messages] };
    }

    return { messages };
  },
  processResponse: (content) => {
    if (typeof content !== "string") {
      return JSON.stringify(content);
    }

    // Try to extract JSON from content if it might be wrapped
    const jsonMatch =
      content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);

    if (jsonMatch && jsonMatch[1] !== undefined) {
      return jsonMatch[1];
    }
    return content;
  },
};

/**
 * Default strategy for models without schema
 */
export const defaultStrategy: ModelStrategy = {
  name: "default",
  prepareRequest: () => {
    throw new Error("Schema strategy not implemented");
  },
  processResponse: (content) => (typeof content === "string" ? content : JSON.stringify(content)),
};
