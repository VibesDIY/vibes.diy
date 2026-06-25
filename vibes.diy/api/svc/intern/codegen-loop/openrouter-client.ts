import { OpenRouter } from "@openrouter/agent";

/**
 * Construct the OpenRouter client for server-side whole-file codegen.
 * The API key is read from the environment via env.get(), which abstracts
 * over Cloudflare Workers env (Durable Objects context) and ensures
 * the key is never logged or exposed in error messages.
 */
export function makeOpenRouterClient(env: { get(key: string): string | undefined }): OpenRouter {
  const apiKey = env.get("OPENROUTER_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set for the whole-file codegen path");
  }
  return new OpenRouter({ apiKey });
}
