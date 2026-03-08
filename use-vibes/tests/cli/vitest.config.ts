import { defineConfig } from "vitest/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: "use-vibes-cli",
    root: __dirname,
    include: ["cli.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    globals: true,
    testTimeout: 30000,
  },
});
