import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    name: "prompts:browser",
    // *.node.test.* are node-only (e.g. read theme assets via node:fs) and must
    // not run under the browser project, where node builtins are externalized.
    exclude: ["dist/**", "node_modules/**", "**/*.node.test.?(c|m)[jt]s?(x)"],
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
    // Reuse the browser context across files within a worker instead of tearing
    // it down per file. The two files that module-mocked @vibes.diy/prompts
    // (which would bleed across files in a shared worker) now test the real
    // implementation, so there's no cross-file mock bleed surface. See #2457.
    isolate: false,
  },
});
