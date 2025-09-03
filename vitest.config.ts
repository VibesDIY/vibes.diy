import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
    "./vitest.tests.config.ts", "./vitest.useSimpleChat.config.ts",
      "call-ai/tests/unit/vitest.config.ts",
      "call-ai/tests/integration/vitest.config.ts",
      "use-vibes/tests/vitest.config.ts",
      "prompts/tests/vitest.node.config.ts",
      "prompts/tests/vitest.browser.config.ts",
    ],
  },
});
