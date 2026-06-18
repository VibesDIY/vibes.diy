/**
 * Non-streaming API call implementation for call-ai
 */
import { AIResult, SchemaStrategy, APIResponse } from "./types.js";
import { PACKAGE_VERSION } from "./version.js";

// Import package version for debugging
const FALLBACK_MODEL = "openrouter/auto";

// Extract content from API response accounting for different formats
function extractContent(result: AIResult, schemaStrategy: SchemaStrategy): string {
  // Debug output has been removed for brevity

  if (!result) {
    return "";
  }

  // Handle different response formats
  if (result.choices && result.choices.length > 0) {
    const choice = result.choices[0];

    // Handle OpenAI format - content directly in message
    if (choice.message && choice.message.content) {
      return schemaStrategy.processResponse(choice.message.content);
    }

    // Handle function call response - pass through the schemaStrategy
    if (choice.message && choice.message.function_call) {
      return schemaStrategy.processResponse(choice.message.function_call);
    }

    // Handle function/tools response (newer format)
    if (choice.message && choice.message.tool_calls) {
      return schemaStrategy.processResponse(choice.message.tool_calls);
    }

    // Handle anthropic/claude format with content blocks
    if (choice.message && Array.isArray(choice.message.content)) {
      let textContent = "";
      let toolUse = null;

      // Find text or tool_use blocks
      for (const block of choice.message.content) {
        if (block.type === "text") {
          textContent += block.text || "";
        } else if (block.type === "tool_use") {
          toolUse = block;
          break; // We found what we need
        }
      }

      // If we have a tool_use block, that takes precedence
      if (toolUse) {
        return schemaStrategy.processResponse(toolUse);
      }

      // Otherwise use the accumulated text content
      return schemaStrategy.processResponse(textContent);
    }

    // Fallback for simple text response
    if (choice.text) {
      return schemaStrategy.processResponse(choice.text);
    }
  }
  if (typeof result !== "string") {
    throw new Error(`Failed to extract content from API response: ${JSON.stringify(result)}`);
  }

  // Return raw result if we couldn't extract content
  return result;
}

// Extract response from Claude API with timeout handling
async function extractClaudeResponse(response: Response): Promise<NonNullable<unknown>> {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Timeout extracting Claude response"));
      }, 5000); // 5 second timeout
    });

    const responsePromise = response.json();

    // Race between timeout and response
    const json = (await Promise.race([responsePromise, timeoutPromise])) as APIResponse;

    if (json.choices && json.choices.length > 0 && json.choices[0].message && json.choices[0].message.content) {
      return json.choices[0].message.content;
    }

    // If content not found in expected structure, return the whole JSON
    return json;
  } catch (error) {
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Failed to extract Claude response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { extractContent, extractClaudeResponse, PACKAGE_VERSION, FALLBACK_MODEL };
