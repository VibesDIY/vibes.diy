import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use global setup and teardown
    globalSetup: [],

    // Include all test files (TypeScript)
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],

    // Set environment variables for tests
    env: {
      SERVER_OPENROUTER_PROV_KEY: "test-provisioning-key",
    },

    // Configure test environment
    environment: "node",

    // Add reporters for test output
    reporters: ["verbose"],

    // Allow usage of expect, describe, it globals without imports
    globals: true,
  },
  server: {
    cors: false, // disable Vite's built-in CORS setting
  },
});
