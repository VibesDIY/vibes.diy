import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Vitest configuration for Cloudflare Workers unit tests
 *
 * This config runs fast unit tests using vitest-pool-workers with Miniflare.
 * It excludes Durable Object tests which require loading the main worker.
 *
 * For DO integration tests, use: pnpm test:do
 * (uses vitest.do.config.ts with wrangler's unstable_dev API)
 *
 * Test scripts:
 * - pnpm test        - Run unit tests (KV, rate-limiter, streaming)
 * - pnpm test:do     - Run DO integration tests
 * - pnpm test:all    - Run all tests
 */
export default defineWorkersConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: [
      "node_modules/**",
      "dist/**",
      // DO tests require main worker with Drizzle SQL migrations
      "durable-database.test.ts",
      "usage-tracking.test.ts",
    ],
    globals: true,
    reporters: ["verbose"],
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2025-04-07",
          compatibilityFlags: ["nodejs_compat"],
          kvNamespaces: ["KV"],
          rateLimits: [
            {
              binding: "BURST_LIMITER",
              namespace_id: "1001",
              simple: { limit: 60, period: 60 },
            },
          ],
        },
      },
    },
  },
});
