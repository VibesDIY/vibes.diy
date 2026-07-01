import { defineConfig } from "vitest/config";

// Unit tests that ship *inside* a vibe (e.g. rolling-today's access-control and
// data-shape guards). These are plain-JS logic tests with no bundler/runtime deps,
// so they run in a Node environment. Registered as a project in the root
// vitest.config.ts so CI actually executes them.
export default defineConfig({
  test: {
    name: "vibes",
    include: ["**/*.test.{js,jsx}"],
    environment: "node",
  },
});
