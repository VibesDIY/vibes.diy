import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "vibes.diy/tests/app/vitest.config.ts",
      "vibes.diy/tests/simple-chat/vitest.config.ts",
      "call-ai/tests/unit/vitest.config.ts",
      "call-ai/tests/integration/vitest.config.ts",
      "use-vibes/tests/vitest.config.ts",
      "prompts/tests/vitest.node.config.ts",
      "prompts/tests/vitest.browser.config.ts",
      "hosting/tests/unit/vitest.config.ts",
    ],
  },
});
