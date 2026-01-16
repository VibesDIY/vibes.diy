/**
 * Response metadata handling for call-ai
 */

import { ResponseMeta } from "./types.js";

// WeakMap to store metadata for responses without modifying the response objects
const responseMetadata = new WeakMap<object, ResponseMeta>();

// Store for string responses - we need to box strings since WeakMap keys must be objects
const stringResponseMap = new Map<string, object>();

/**
 * Helper to box a string so it can be used with WeakMap
 * @internal
 */
function boxString(str: string): object {
  // Check if already boxed
  if (stringResponseMap.has(str)) {
    return stringResponseMap.get(str) as object;
  }
  // Create a new box
  const box = Object.create(null);
  stringResponseMap.set(str, box);
  return box;
}

/**
 * Retrieve metadata associated with a response from callAi()
 * @param response A response from callAi, either string or AsyncGenerator
 * @returns The metadata object if available, undefined otherwise
 */
function getMeta(response: string | AsyncGenerator<string, string, unknown>): ResponseMeta | undefined {
  if (typeof response === "string") {
    const box = stringResponseMap.get(response);
    if (box) {
      return responseMetadata.get(box);
    }
    return undefined;
  }
  // For AsyncGenerator and other objects, look up directly
  return responseMetadata.get(response as object);
}

export { responseMetadata, stringResponseMap, boxString, getMeta };
