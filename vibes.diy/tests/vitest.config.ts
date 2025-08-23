import { defineConfig } from "vitest/config";
// import react from '@vitejs/plugin-react';
import tsconfigPaths from "vite-tsconfig-paths";
// import typescript from "@rollup/plugin-typescript";

export default defineConfig({
  plugins: [
    //typescript({
    //  tsconfig: './tsconfig.test.json'
    //}),
    tsconfigPaths({
      configNames: ["tsconfig.test.json"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
    //    react()
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./setup.ts"],
  },
});
