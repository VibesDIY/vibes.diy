import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "vibes-diy",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
