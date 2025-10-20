import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Include all test files (TypeScript)
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],

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
