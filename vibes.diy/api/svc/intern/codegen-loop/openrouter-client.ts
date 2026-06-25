import { OpenRouter } from "@openrouter/agent";

/**
 * Construct the OpenRouter client for server-side whole-file codegen.
 * The API key is read from the environment via env.get(), which abstracts
 * over Cloudflare Workers env (Durable Objects context) and ensures
 * the key is never logged or exposed in error messages.
 */
export function makeOpenRouterClient(env: { get(key: string): string | undefined }): OpenRouter {
  // Prefer an explicit OPENROUTER_API_KEY, but fall back to LLM_BACKEND_API_KEY:
  // in every environment (local, dev, preview, prod, cli) that value is already an
  // OpenRouter key — LLM_BACKEND_URL points at openrouter.ai. The fallback lets the
  // whole-file path run on the existing LLM credentials with no new secret to
  // provision, which is what makes flag-gated preview testing viable.
  const apiKey = env.get("OPENROUTER_API_KEY")?.trim() || env.get("LLM_BACKEND_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("Neither OPENROUTER_API_KEY nor LLM_BACKEND_API_KEY is set for the whole-file codegen path");
  }
  return new OpenRouter({ apiKey });
}
