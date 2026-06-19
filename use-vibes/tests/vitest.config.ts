import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

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
      provider: playwright(),
      instances: [
        {
          browser: "chromium",
        },
      ],
    },
  },
});
