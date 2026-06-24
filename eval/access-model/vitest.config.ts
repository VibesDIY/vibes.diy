import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "eval-access-model",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/runs/**"],
  },
});
