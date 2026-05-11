import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [tsconfigPaths({ configNames: ["tsconfig.test.json"] }) as never],
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "@testing-library/react", "react-markdown", "react-router-dom"],
    exclude: ["fsevents", "lightningcss"],
  },
  // cacheDir: "./node_modules/.vibes.diy-vite-cache",
  test: {
    // setupFiles: ["./moduleSetup.ts", "./setup.ts"],
    name: "vibes.diy",
    exclude: ["dist/**", "node_modules/**", "ssr/**"],
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
    maxWorkers: 3,
    sequence: {
      // Unique groupOrder so vitest doesn't conflate this project's maxWorkers
      // with sibling projects' defaults (vitest 4.1.5 errors if same groupOrder
      // has different maxWorkers).
      groupOrder: 1,
    },
    testTimeout: 30000,
    hookTimeout: 10000,
  },
});
