/**
 * Strategy selection logic for different AI models
 */
import { Schema, SchemaStrategy } from "../types.js";
import { claudeStrategy, defaultStrategy, geminiStrategy, openAIStrategy, systemMessageStrategy } from "./model-strategies.js";

/**
 * Choose the appropriate schema strategy based on model and schema
 */
export function chooseSchemaStrategy(model: string | undefined, schema: Schema | null): SchemaStrategy {
  // Default model if not provided
  const resolvedModel = model || (schema ? "openai/gpt-4o" : "openrouter/auto");

  // No schema case - use default strategy
  if (!schema) {
    return {
      strategy: "none",
      model: resolvedModel,
      prepareRequest: defaultStrategy.prepareRequest,
      processResponse: defaultStrategy.processResponse,
      shouldForceStream: false,
    };
  }

  // Check for Claude models
  if (/claude/i.test(resolvedModel)) {
    return {
      strategy: "tool_mode",
      model: resolvedModel,
      prepareRequest: claudeStrategy.prepareRequest,
      processResponse: claudeStrategy.processResponse,
      shouldForceStream: !!claudeStrategy.shouldForceStream,
    };
  }

  // Check for Gemini models
  if (/gemini/i.test(resolvedModel)) {
    return {
      strategy: "json_schema",
      model: resolvedModel,
      prepareRequest: geminiStrategy.prepareRequest,
      processResponse: geminiStrategy.processResponse,
      shouldForceStream: !!geminiStrategy.shouldForceStream,
    };
  }

  // Check for GPT-4 Turbo models - use system message approach
  if (/gpt-4-turbo/i.test(resolvedModel)) {
    return {
      strategy: "system_message",
      model: resolvedModel,
      prepareRequest: systemMessageStrategy.prepareRequest,
      processResponse: systemMessageStrategy.processResponse,
      shouldForceStream: !!systemMessageStrategy.shouldForceStream,
    };
  }

  // Check for OpenAI models
  if (/openai|gpt/i.test(resolvedModel)) {
    return {
      strategy: "json_schema",
      model: resolvedModel,
      prepareRequest: openAIStrategy.prepareRequest,
      processResponse: openAIStrategy.processResponse,
      shouldForceStream: !!openAIStrategy.shouldForceStream,
    };
  }

  // Check for other specific models that need system message approach
  if (/llama-3|deepseek/i.test(resolvedModel)) {
    return {
      strategy: "system_message",
      model: resolvedModel,
      prepareRequest: systemMessageStrategy.prepareRequest,
      processResponse: systemMessageStrategy.processResponse,
      shouldForceStream: !!systemMessageStrategy.shouldForceStream,
    };
  }

  // Default to system message approach for unknown models with schema
  return {
    strategy: "system_message",
    model: resolvedModel,
    prepareRequest: systemMessageStrategy.prepareRequest,
    processResponse: systemMessageStrategy.processResponse,
    shouldForceStream: !!systemMessageStrategy.shouldForceStream,
  };
}
