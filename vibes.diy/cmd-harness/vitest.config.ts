import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "cmd-harness",
    include: ["**/*.test.ts"],
  },
});
