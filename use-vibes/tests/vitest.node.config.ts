import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "use-vibes:node",
    exclude: ["dist/**", "node_modules/**"],
    include: ["**/*.node.test.?(c|m)[jt]s?(x)"],
  },
});
