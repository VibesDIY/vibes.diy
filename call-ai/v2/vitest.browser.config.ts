import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    name: "browser",
    include: ["**/*.test.ts"],
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
    // it down per file. These tests use no module mocks or global stubs, so
    // there's no cross-file bleed surface; this just amortizes per-file context
    // setup. See the app project's isolate:false hardening (#2457).
    isolate: false,
  },
});
