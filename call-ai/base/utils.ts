/**
 * Utility functions for call-ai
 */

import { ProcessedSchema } from "./types.js";
import { URI } from "@adviser/cement";
// import { process } from 'node:process';

/**
 * Recursively adds additionalProperties: false to all object types in a schema
 * This is needed for OpenAI's strict schema validation in streaming mode
 */
export function recursivelyAddAdditionalProperties(schema: ProcessedSchema): ProcessedSchema {
  // Clone to avoid modifying the original
  const result = { ...schema };

  // If this is an object type, ensure it has additionalProperties: false
  if (result.type === "object") {
    // Set additionalProperties if not already set
    if (result.additionalProperties === undefined) {
      result.additionalProperties = false;
    }

    // Process nested properties if they exist
    if (result.properties) {
      result.properties = { ...result.properties };

      // Set required if not already set - OpenAI requires this for all nested objects
      if (result.required === undefined) {
        result.required = Object.keys(result.properties);
      }

      // Check each property
      Object.keys(result.properties).forEach((key) => {
        const prop = result.properties[key];

        // If property is an object or array type, recursively process it
        if (prop && typeof prop === "object") {
          const oprop = prop as ProcessedSchema;
          result.properties[key] = recursivelyAddAdditionalProperties(oprop);

          // For nested objects, ensure they also have all properties in their required field
          if (oprop.type === "object" && oprop.properties) {
            oprop.required = Object.keys(oprop.properties);
          }
        }
      });
    }
  }

  // Handle nested objects in arrays
  if (result.type === "array" && result.items && typeof result.items === "object") {
    result.items = recursivelyAddAdditionalProperties(result.items);

    // If array items are objects, ensure they have all properties in required
    if (result.items.type === "object" && result.items.properties) {
      result.items.required = Object.keys(result.items.properties);
    }
  }

  return result;
}

export function entriesHeaders(headers: Headers) {
  const entries: [string, string][] = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
}

export function callAiFetch(options: { mock?: { fetch?: typeof fetch } }): typeof fetch {
  return options.mock?.fetch || globalThis.fetch;
}

/**
 * Keys handled by call-ai that should NOT be passed through to the API request body.
 * Defined once here to avoid duplication between streaming.ts and non-streaming.ts.
 */
const HANDLED_OPTION_KEYS = [
  "apiKey",
  "model",
  "endpoint",
  "stream",
  "schema",
  "schemaStrategy",
  "maxTokens",
  "temperature",
  "topP",
  "responseFormat",
  "referer",
  "title",
  "headers",
  "skipRefresh",
  "skipRetry",
  "debug",
  "mock",
  "onChunk",
  "chatUrl",
  "refreshToken",
  "onRefreshToken",
] as const;

/**
 * Copy passthrough options (anything not explicitly handled) to request body.
 */
export function copyPassthroughOptions(
  options: Record<string, unknown>,
  requestBody: Record<string, unknown>,
): void {
  for (const key of Object.keys(options)) {
    if (!HANDLED_OPTION_KEYS.includes(key as (typeof HANDLED_OPTION_KEYS)[number])) {
      requestBody[key] = options[key];
    }
  }
}

/**
 * Safely joins a base URL with a path, avoiding double slashes
 * Uses cement's URI utilities for proper URL handling
 */
export function joinUrlParts(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  if (!path) return baseUrl;

  // Use cement's URI utilities to safely resolve the path
  return URI.from(baseUrl).build().resolve(path).toString();
}
