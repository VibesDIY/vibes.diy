import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "vibe-tests",
    exclude: ["dist/**", "node_modules/**"],
    include: ["**/*test.?(c|m)[jt]s?(x)"],
  },
});
