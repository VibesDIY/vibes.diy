/**
 * Custom environment variable type declarations
 * These are set as Cloudflare Worker secrets via wrangler secret put
 * See: .github/workflows/hosting-deploy.yaml and hosting/actions/deploy/action.yaml
 */

declare namespace Cloudflare {
  interface Env {
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
  }
}
