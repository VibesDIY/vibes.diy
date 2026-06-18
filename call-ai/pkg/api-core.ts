/**
 * Core API implementation for call-ai
 */

import { StreamResponse, ThenableStreamResponse } from "./types.js";

/**
 * Create a proxy that acts both as a Promise and an AsyncGenerator for backward compatibility
 * @internal This is for internal use only, not part of public API
 */
function createBackwardCompatStreamingProxy(promise: Promise<StreamResponse>): ThenableStreamResponse {
  // Create a proxy that forwards methods to the Promise or AsyncGenerator as appropriate
  return new Proxy({} as ThenableStreamResponse, {
    get(_target, prop) {
      // First check if it's an AsyncGenerator method (needed for for-await)
      if (prop === "next" || prop === "throw" || prop === "return" || prop === Symbol.asyncIterator) {
        // Create wrapper functions that await the Promise first
        if (prop === Symbol.asyncIterator) {
          return function () {
            return {
              // Implement async iterator that gets the generator first
              async next(value: unknown) {
                try {
                  const generator = await promise;
                  return generator.next(value);
                } catch (error) {
                  // Turn Promise rejection into iterator result with error thrown
                  return Promise.reject(error);
                }
              },
            };
          };
        }

        // Methods like next, throw, return
        return async function (value: unknown) {
          const generator = await promise;
          switch (prop) {
            case "next":
              return generator.next(value);
            case "throw":
              return generator.throw(value);
            case "return":
              return generator.return(value as string);
            default:
              throw new Error(`Unknown method: ${String(prop)}`);
          }
        };
      }

      // Then check if it's a Promise method
      if (prop === "then" || prop === "catch" || prop === "finally") {
        return promise[prop].bind(promise);
      }

      return undefined;
    },
  });
}

// Export main API functions
export { createBackwardCompatStreamingProxy };
