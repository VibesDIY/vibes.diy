import { Result } from "@adviser/cement";
import { OpenRouter } from "@openrouter/agent";

/**
 * Construct the OpenRouter client for server-side whole-file codegen. The API
 * key is read from the environment via env.get(), which abstracts over Cloudflare
 * Workers env (Durable Objects context) and ensures the key is never logged or
 * exposed. Returns a `Result` (no throw) so the call site fails the turn cleanly.
 */
export function makeOpenRouterClient(env: { get(key: string): string | undefined }): Result<OpenRouter> {
  // Prefer an explicit OPENROUTER_API_KEY, but fall back to LLM_BACKEND_API_KEY:
  // in every environment (local, dev, preview, prod, cli) that value is already an
  // OpenRouter key — LLM_BACKEND_URL points at openrouter.ai. The fallback lets the
  // whole-file path run on the existing LLM credentials with no new secret to
  // provision, which is what makes flag-gated preview testing viable.
  const primary = env.get("OPENROUTER_API_KEY")?.trim();
  const apiKey = primary !== undefined && primary.length > 0 ? primary : env.get("LLM_BACKEND_API_KEY")?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    return Result.Err("Neither OPENROUTER_API_KEY nor LLM_BACKEND_API_KEY is set for the whole-file codegen path");
  }
  return Result.Ok(new OpenRouter({ apiKey }));
}
