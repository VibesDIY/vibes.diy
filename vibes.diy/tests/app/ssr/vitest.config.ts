import { defineConfig } from "vitest/config";

// SSR safety tests for app routes — runs in node env so global `window` is
// undefined, mirroring the Cloudflare worker server-render context. Use to
// guard against synchronous `window.foo` references in route components.
export default defineConfig({
  test: {
    name: "vibes.diy-ssr",
    exclude: ["node_modules/**", "dist/**"],
    include: ["**/*.test.?(c|m)[jt]s?(x)"],
    environment: "node",
  },
});
