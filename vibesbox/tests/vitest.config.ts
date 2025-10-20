import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@vibes.diy/vibesbox": path.resolve(__dirname, "../pkg/src/index.ts"),
    },
  },
  test: {
    name: "@vibes.diy/vibesbox-tests",

    // Include all test files (TypeScript)
    include: ["unit/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],

    // Configure test environment
    environment: "node",

    // Add reporters for test output
    reporters: ["verbose"],

    // Allow usage of expect, describe, it globals without imports
    globals: true,
  },
});
