import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  plugins: [tsconfigPaths({ configNames: ["tsconfig.test.json"] }) as never],
  optimizeDeps: {
    // `react-hot-toast` must be pre-bundled here: under `isolate: false` (shared
    // worker), the first test to import it would otherwise trigger a mid-run Vite
    // re-optimize + reload, corrupting the in-flight import of whichever file is
    // loading — surfacing as a flaky "Failed to import test file" (e.g.
    // copyable-toaster.test.tsx). Listing it up front makes the bundling deterministic.
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "@testing-library/react",
      "react-markdown",
      "react-router-dom",
      "react-hot-toast",
    ],
    // `find-up` (Node-only keybag chain behind @vibes.diy/identity/node, reached
    // via fireproof-node's dynamic import) imports `unicorn-magic`'s `toPath`,
    // which esbuild can't pre-bundle; the keybag path never runs in-browser.
    exclude: ["fsevents", "lightningcss", "find-up"],
  },
  // cacheDir: "./node_modules/.vibes.diy-vite-cache",
  test: {
    setupFiles: ["./clerk-test-mock.ts"],
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
    // Experiment: reuse the browser page/context across files within a worker
    // instead of tearing it down per file (default isolate: true). The pre-run
    // instrumentation (#2456) showed this project burns ~870s of `prepare`
    // (~14s/file × 63) to run ~9s of actual tests — almost all per-file context
    // rebuild. isolate:false amortizes setup to ~once per worker.
    //
    // Tradeoff: state bleeds across files in a worker (DOM, module-level
    // singletons, Fireproof stores) — the #1515 state-bleed failure class.
    // RTL auto-cleanup handles unmounts; watch test-phase-timing.json for the
    // prepare delta and re-run CI a few times to flush out order-dependent
    // flakes before relying on this.
    isolate: false,
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
