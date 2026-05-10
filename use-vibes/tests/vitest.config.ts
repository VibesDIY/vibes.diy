import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "@testing-library/react"],
  },
  test: {
    name: "use-vibes",
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
  },
});
