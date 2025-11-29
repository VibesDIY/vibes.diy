/**
 * Type definitions for call-ai
 */

import { callAi } from "./api.js";

export type Falsy = false | null | undefined | 0 | "";

export interface OriginalError {
  readonly originalError: Error;
  readonly refreshError: Error;
  readonly status: number;
}

/**
 * Content types for multimodal messages
 */
export interface ContentItem {
  readonly type: "text" | "image_url";
  readonly text?: string;
  readonly image_url?: {
    readonly url: string;
  };
}

/**
 * Message type supporting both simple string content and multimodal content
 */
export interface Message {
  readonly role: "user" | "system" | "assistant";
  readonly content: string | ContentItem[];
}

/**
 * Metadata associated with a response
 * Available through the getMeta() helper function
 */
export interface ResponseMeta {
  /**
   * The model used for the response
   */
  model: string;

  /**
   * The endpoint used for the response
   */
  endpoint?: string;

  /**
   * Timing information about the request
   */
  timing: {
    readonly startTime: number;
    endTime?: number;
    duration?: number;
  };

  /**
   * Raw response data from the fetch call
   * Contains the parsed JSON result from the API call
   */
  rawResponse?: ModelId | string;
}

export interface ModelId {
  readonly model: string;
  readonly id: string;
}

export interface Schema {
  /**
   * Optional schema name - will be sent to OpenRouter if provided
   * If not specified, defaults to "result"
   */
  readonly name?: string;
  /**
   * Properties defining the structure of your schema
   */
  readonly properties: Record<string, unknown>;
  /**
   * Fields that are required in the response (defaults to all properties)
   */
  readonly required?: string[];
  /**
   * Whether to allow fields not defined in properties (defaults to false)
   */
  readonly additionalProperties?: boolean;
  /**
   * Any additional schema properties to pass through
   */
  readonly [key: string]: unknown;
}

export interface ToolUseType {
  readonly type: "tool_use";
  readonly input: string;
  readonly tool_calls: OpenAIFunctionCall[];
}
export function isToolUseType(obj: unknown): obj is ToolUseType {
  return !!obj && (obj as ToolUseType).type === "tool_use";
}

export interface ToolUseResponse {
  readonly tool_use: {
    readonly input: string;
  };
}
export function isToolUseResponse(obj: unknown): obj is ToolUseResponse {
  return !!obj && (obj as ToolUseResponse).tool_use !== undefined;
}

export interface AIResult {
  choices: {
    message: {
      content?: string;
      function_call: string | ToolUseType | ToolUseResponse;
      tool_calls?: string;
    };
    text?: string;
  }[];
}

export interface APIErrorResponse {
  error?:
    | {
        message?: string;
        type?: string;
      }
    | string;
}

export interface APIResponse extends Partial<AIResult>, APIErrorResponse {}

export interface KeyRefreshResponse {
  key?:
    | string
    | {
        key?: string;
        hash?: string;
        metadata?: unknown;
      };
  hash?: string;
  metadata?: unknown;
}

export interface OpenAIFunctionCall {
  readonly type: "function";
  readonly function: {
    readonly arguments?: string;
    readonly name?: string;
    readonly description?: string;
    readonly parameters?: RequestSchema | ProcessedSchema;
  };
}

export function isOpenAIArray(obj: unknown): obj is OpenAIFunctionCall[] {
  return Array.isArray(obj) && obj.length > 0 && obj[0].function !== undefined;
}

export interface RequestSchema {
  model?: string;
  name?: string;
  type: "object";
  description?: string;
  properties?: unknown;
  required?: unknown[];
  parameters?: RequestSchema;
  additionalProperties?: unknown;
}

export interface SchemaAIMessageRequest {
  model: string;
  messages: Message[];
  max_tokens: number;
  temperature: number;
  top_p: number;
  stream: boolean;
  response_format?: SchemaAIJsonSchemaRequest["response_format"] | SchemaAIJsonObjectRequest["response_format"];
  [key: string]: unknown;
}

export interface ProcessedSchema {
  properties: Record<string, unknown>;
  items?: ProcessedSchema;
  [key: string]: unknown;
}

export interface SchemaType {
  readonly type: string;
}

export interface SchemaDescription {
  readonly description: string;
}

export interface SchemaAIJsonObjectRequest {
  response_format: {
    type: "json_object";
  };
}

export interface SchemaAIJsonSchemaRequest {
  response_format: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict?: boolean;
      schema: ProcessedSchema;
    };
  };
}

interface SchemaAIToolRequest {
  tools: OpenAIFunctionCall[];
  tool_choice: OpenAIFunctionCall;
}

interface SchemaAISimpleMsg {
  readonly messages: Message[];
}

/**
 * Strategy interface for handling different model types
 */
export interface ModelStrategy {
  readonly name: string;
  readonly prepareRequest: (
    schema: Schema | Falsy,
    messages: Message[],
  ) => SchemaAISimpleMsg | SchemaAIMessageRequest | SchemaAIToolRequest | SchemaAIJsonSchemaRequest | SchemaAIJsonObjectRequest;
  // | undefined;
  readonly processResponse: (content: string | ToolUseType | ToolUseResponse | OpenAIFunctionCall[]) => string;
  readonly shouldForceStream?: boolean;
}

export interface CallAIErrorParams {
  readonly message: string;
  readonly status: number;
  readonly statusText?: string;
  readonly details?: unknown;
  readonly contentType?: string;
  readonly statusCode?: number;
  readonly response?: {
    readonly status: number;
  };
  readonly partialContent?: string;
  readonly name?: string;
  readonly cause?: unknown;
  readonly originalError?: CallAIErrorParams | Error;
  readonly refreshError?: unknown;
  readonly errorType?: string;
}
export class CallAIError extends Error {
  readonly message: string;
  readonly status: number;
  readonly statusText?: string;
  readonly details?: unknown;
  readonly contentType?: string;
  readonly originalError?: CallAIErrorParams | Error;
  readonly refreshError?: unknown;
  readonly errorType?: string;
  readonly partialContent?: string;

  constructor(params: CallAIErrorParams) {
    super(params.message);
    this.message = params.message;
    this.status = params.status;
    this.statusText = params.statusText;
    this.details = params.details;
    this.contentType = params.contentType;
    this.originalError = params.originalError;
    this.partialContent = params.partialContent;
    this.refreshError = params.refreshError;
    this.errorType = params.errorType;
  }
}

/**
 * Schema strategies for different model types
 */
export type SchemaStrategyType = "json_schema" | "tool_mode" | "system_message" | "none";

/**
 * Strategy selection result
 */
export interface SchemaStrategy {
  readonly strategy: SchemaStrategyType;
  readonly model: string;
  readonly prepareRequest: ModelStrategy["prepareRequest"];
  readonly processResponse: ModelStrategy["processResponse"];
  readonly shouldForceStream: boolean;
}

/**
 * Return type for streaming API calls
 */
export type StreamResponse = AsyncGenerator<string, string, unknown>;

/**
 * @internal
 * Internal type for backward compatibility with v0.6.x
 * This type is not exposed in public API documentation
 */
export type ThenableStreamResponse = AsyncGenerator<string, string, unknown> & Promise<StreamResponse>;

export interface CallAIOptions {
  /**
   * API key for authentication
   */
  readonly apiKey?: string;

  /**
   * Model ID to use for the request
   */
  readonly model?: string;

  /**
   * API endpoint to send the request to
   */
  readonly endpoint?: string;

  /**
   * Custom origin for chat API
   * Can also be set via window.CALLAI_CHAT_URL or callAiEnv.CALLAI_CHAT_URL
   */
  readonly chatUrl?: string;

  /**
   * Whether to stream the response
   */
  stream?: boolean;

  /**
   * Authentication token for key refresh service
   * Can also be set via window.CALL_AI_REFRESH_TOKEN, callAiEnv.CALL_AI_REFRESH_TOKEN, or default to "use-vibes"
   */
  refreshToken?: string;

  /**
   * Callback function to update refresh token when current token fails
   * Gets called with the current failing token and should return a new token
   * @param currentToken The current refresh token that failed
   * @returns A Promise that resolves to a new refresh token
   */
  readonly updateRefreshToken?: (currentToken: string) => Promise<string>;

  /**
   * Schema for structured output
   */
  readonly schema?: Schema | null;

  /**
   * Modalities to enable in the response (e.g., ["image", "text"])
   * Used for multimodal models that can generate images
   */
  readonly modalities?: string[];

  /**
   * Whether to skip retry with fallback model when model errors occur
   * Useful in testing and cases where retries should be suppressed
   */
  readonly skipRetry?: boolean;

  /**
   * Skip key refresh on 4xx errors
   * Useful for testing error conditions or when you want to handle refresh manually
   */
  readonly skipRefresh?: boolean;

  /**
   * Enable raw response logging without any filtering or processing
   */
  readonly debug?: boolean;

  readonly referer?: string;
  readonly title?: string;

  readonly schemaStrategy?: SchemaStrategy;

  readonly maxTokens?: number;
  temperature?: number;
  readonly topP?: number;
  response_format?: { type: "json_object" };

  readonly mock?: Mocks;

  /**
   * Any additional options to pass to the API
   */
  [key: string]: unknown;
}

export interface Mocks {
  readonly fetch?: typeof fetch;
  readonly callAI?: typeof callAi;
}

export interface AIResponse {
  readonly text: string;
  readonly usage?: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
  };
  readonly model: string;
}

/**
 * Response from image generation API
 */
export interface ImageResponse {
  readonly created: number;
  readonly data: {
    readonly b64_json: string;
    readonly url?: string;
    readonly revised_prompt?: string;
  }[];
}

/**
 * Options for image generation
 */
export interface ImageGenOptions {
  /**
   * API key for authentication
   * Defaults to "VIBES_DIY"
   */
  readonly apiKey?: string;

  /**
   * Model to use for image generation
   * Defaults to "gpt-image-1"
   */
  readonly model?: string;

  /**
   * Size of the generated image
   */
  readonly size?: string;

  /**
   * Quality of the generated image
   */
  readonly quality?: string;

  /**
   * Style of the generated image
   */
  readonly style?: string;

  /**
   * For image editing: array of File objects to be edited
   */
  readonly images?: File[];

  /**
   * Custom base URL for the image generation API
   * Can also be set via window.CALLAI_IMG_URL or callAiEnv.CALLAI_IMG_URL
   */
  readonly imgUrl?: string;

  /**
   * Direct API endpoint to use for image generation
   * When provided, this takes precedence over imgUrl and bypasses
   * the default endpoint construction (useful for calling OpenAI directly)
   */
  readonly endpoint?: string;

  /**
   * Enable debug logging
   */
  readonly debug?: boolean;

  readonly mock?: Mocks;
}

/**
 * @deprecated Use ImageGenOptions instead
 */
export type ImageEditOptions = ImageGenOptions;
