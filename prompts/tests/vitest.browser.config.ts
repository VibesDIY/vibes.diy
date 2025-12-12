import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    name: "prompts:browser",
    exclude: ["dist/**", "node_modules/**"],
    include: ["**/*test.?(c|m)[jt]s?(x)"],
    testTimeout: 30000,
    hookTimeout: 10000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        {
          browser: "chromium",
        },
      ],
    },
  },
});

