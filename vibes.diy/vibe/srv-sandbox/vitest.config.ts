import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "vibe-srv-sandbox",
    environment: "node",
    include: ["srv-sandbox.test.ts"],
  },
});
