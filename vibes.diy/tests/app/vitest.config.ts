import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [
    tsconfigPaths({
      configNames: ["tsconfig.test.json"],
    }),
  ],
  optimizeDeps: {
    exclude: ["fsevents", "lightningcss"],
  },
  // cacheDir: "./node_modules/.vibes.diy-vite-cache",
  test: {
    // setupFiles: ["./moduleSetup.ts", "./setup.ts"],
    name: "vibes.diy",
    exclude: ["dist/**", "node_modules/**"],
    include: ["**/*test.?(c|m)[jt]s?(x)"],
    /*
    server: {
      noExternal: [/\.txt$/],
    },
   */
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
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});
