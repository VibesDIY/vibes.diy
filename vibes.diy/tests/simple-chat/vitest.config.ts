import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths({
      configNames: ["tsconfig.test.json"],
    }),
  ],
  // cacheDir: "./node_modules/.vibes.diy-useSimpleChat-vite-cache",
  test: {
    setupFiles: ["./setup.tsx"],
    name: "vibes.diy:useSimpleChat",
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
      provider: "playwright" as const,
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
