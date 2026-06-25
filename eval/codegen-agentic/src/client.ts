import { OpenRouter } from "@openrouter/agent";

/**
 * Construct the OpenRouter client. The key is read from OPENROUTER_API_KEY
 * (fed from the macOS Keychain at invocation time) and never logged.
 */
export function makeClient(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Provide it inline, e.g. " +
        'OPENROUTER_API_KEY="$(security find-generic-password -a "$USER" -s openrouter-api-key -w)" pnpm run generate'
    );
  }
  return new OpenRouter({ apiKey });
}
