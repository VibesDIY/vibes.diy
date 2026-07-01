import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { cloudChromiumProviderOptions } from "../../scripts/vitest-cloud-chromium.mjs";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "@testing-library/react"],
    // `find-up` (pulled in by the Node-only keybag chain behind
    // @vibes.diy/identity/node, reached via fireproof-node's dynamic import)
    // imports `unicorn-magic`'s `toPath`, which esbuild can't pre-bundle.
    // The keybag path never executes in-browser, so externalize it.
    exclude: ["find-up"],
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
      provider: playwright(cloudChromiumProviderOptions()),
      instances: [
        {
          browser: "chromium",
        },
      ],
    },
    // Reuse the browser context across files within a worker instead of tearing
    // it down per file. The useVibes generation-hook tests that module-mocked
    // call-ai / @vibes.diy/prompts (which would bleed across files in a shared
    // worker) were removed with the hook itself, so there's no cross-file mock
    // bleed surface left. See #2467 (and the app project's hardening in #2457).
    isolate: false,
  },
});
