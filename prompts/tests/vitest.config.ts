import { defineConfig } from "vitest/config";
import path from "path";

const testsDir = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  test: {
    projects: [
      path.join(testsDir, "vitest.node.config.ts"),
      path.join(testsDir, "vitest.browser.config.ts"),
    ],
  },
});
