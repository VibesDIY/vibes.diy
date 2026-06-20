/**
 * Core API implementation for call-ai
 */

import { StreamResponse, ThenableStreamResponse } from "./types.js";

/**
 * Create a wrapper that acts both as a Promise and an AsyncGenerator for backward compatibility
 * @internal This is for internal use only, not part of public API
 */
function createBackwardCompatStreamingProxy(promise: Promise<StreamResponse>): ThenableStreamResponse {
  const thenable = promise as ThenableStreamResponse;

  thenable.next = async (value: unknown) => {
    const generator = await promise;
    return generator.next(value);
  };

  thenable.throw = async (value?: unknown) => {
    const generator = await promise;
    return generator.throw(value);
  };

  thenable.return = async (value: string | PromiseLike<string>) => {
    const generator = await promise;
    return generator.return(value);
  };

  thenable[Symbol.asyncIterator] = () => thenable;

  return thenable;
}

// Export main API functions
export { createBackwardCompatStreamingProxy };
