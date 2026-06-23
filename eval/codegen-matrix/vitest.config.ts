import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "eval-codegen-matrix",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/runs/**"],
  },
});
