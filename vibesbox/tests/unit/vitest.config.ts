import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Include all test files (TypeScript) - exclude node_modules explicitly
    include: ["*.test.ts", "**/*.test.ts"],
    exclude: ["node_modules/**", "**/node_modules/**", "dist/**", "**/dist/**"],

    // Configure test environment
    environment: "node",

    // Add reporters for test output
    reporters: ["verbose"],

    // Allow usage of expect, describe, it globals without imports
    globals: true,
  },
  resolve: {
    alias: {
      // Map HTML imports to return as strings
      "./iframe.html": resolve(__dirname, "../../pkg/src/iframe.html"),
      "./wrapper.html": resolve(__dirname, "../../pkg/src/wrapper.html"),
      "./lab.html": resolve(__dirname, "../../pkg/src/lab.html"),
    },
  },
  assetsInclude: ["**/*.html"],
  server: {
    cors: false, // disable Vite's built-in CORS setting
  },
});
