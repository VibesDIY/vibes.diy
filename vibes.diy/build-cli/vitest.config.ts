import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "build-cli",
    include: ["**/*.test.ts"],
  },
});
