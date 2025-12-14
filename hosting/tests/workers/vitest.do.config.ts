import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for Durable Object integration tests
 *
 * These tests use wrangler's unstable_dev API to spin up a real worker
 * with proper bundling (including Drizzle SQL migrations).
 *
 * Run with: pnpm test:do
 */
export default defineConfig({
  test: {
    include: ["durable-database.test.ts", "usage-tracking.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    globals: true,
    reporters: ["verbose"],
    // Longer timeout for unstable_dev startup
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
