import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "use-vibes-cli",
    root: import.meta.dirname,
    include: ["cli.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    testTimeout: 30000,
  },
});
