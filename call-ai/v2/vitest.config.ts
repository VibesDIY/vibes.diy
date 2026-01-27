import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "./vitest.node.config.ts",
      "./vitest.browser.config.ts",
      // "./vitest.cfruntime.config.ts", // requires vitest 3.x, not compatible with 4.x yet
    ],
  },
});
