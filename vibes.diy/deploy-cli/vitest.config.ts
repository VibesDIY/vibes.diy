import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "deploy-cli",
    include: ["**/*.test.ts"],
  },
});
