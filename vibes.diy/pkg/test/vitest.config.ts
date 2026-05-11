import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "pkg-infra",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
  },
});
