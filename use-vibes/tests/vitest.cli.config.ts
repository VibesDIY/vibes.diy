import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "use-vibes-cli",
    include: ["cli/**/*.test.ts"],
    environment: "node",
  },
});
