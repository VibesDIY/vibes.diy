import type { DurableDatabase } from "./durable-database.js";

/**
 * Custom environment variable type declarations
 * These are set as Cloudflare Worker secrets via wrangler secret put
 * See: .github/workflows/hosting-deploy.yaml and hosting/actions/deploy/action.yaml
 */

// Since this file has an import, we need declare global to augment Cloudflare namespace
declare global {
  namespace Cloudflare {
    interface Env {
      // Environment identifier
      ENVIRONMENT?: string;

      // AI API Keys (set as secrets)
      SERVER_OPENROUTER_API_KEY?: string;
      OPENAI_API_KEY?: string;
      OPENROUTER_API_KEY?: string;
      CALLAI_API_KEY?: string;
      ANTHROPIC_API_KEY?: string;

      // Authentication keys (set as secrets)
      CLERK_SECRET_KEY: string;
      CLERK_SECRET_KEY_TEST?: string;
      CLERK_PUBLISHABLE_KEY: string;

      // Integration secrets (optional)
      DISCORD_WEBHOOK_URL?: string;
      BLUESKY_APP_PASSWORD?: string;

      // Rate limiting - burst protection for API endpoints
      BURST_LIMITER: RateLimiter;

      // Usage tracking queue
      USAGE_QUEUE: Queue<UsageTrackingMessage>;

      // Durable Objects - per-user SQLite databases
      DURABLE_DATABASE: DurableObjectNamespace<DurableDatabase>;
    }
  }

  // Usage tracking message format
  interface UsageTrackingMessage {
    userId: string;
    generationId: string;
  }
}

export {};
