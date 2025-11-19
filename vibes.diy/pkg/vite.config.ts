import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import type { ConfigEnv, UserConfig } from "vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ mode }: ConfigEnv): UserConfig => {
  // Disable React Router plugin for tests or when explicitly disabled
  const disableReactRouter =
    mode === "test" || process.env.DISABLE_REACT_ROUTER === "true";
  console.log("disableReactRouter", disableReactRouter);

  return {
    plugins: [
      tailwindcss(),
      // Only include React Router plugin when not disabled
      tsconfigPaths({
        configNames: ["tsconfig.dev.json"],
      }),
      //      cloudflare(),
      ...(!disableReactRouter ? [reactRouter()] : []),
    ],
    base: process.env.VITE_APP_BASENAME || "/",
    build: {
      outDir: "build",
      rollupOptions: {
        external: [
          "react",
          "react-dom",
          "react-dom/client",
          "react/jsx-runtime",
        ],
      },
    },
    // Define global constants
    // define: {
    //   IFRAME__CALLAI_API_KEY: JSON.stringify(env.VITE_OPENROUTER_API_KEY),
    // },
    // Server configuration for local development
    server: {
      host: "0.0.0.0", // Listen on all local IPs
      port: 8888,
      allowedHosts: ["devserver-main--fireproof-ai-builder.netlify.app"], // Specific ngrok hostname
      cors: true, // Enable CORS for all origins
      hmr: true, // Use default HMR settings for local development
      // Ignore test directory changes to prevent unnecessary reloads during development
      watch: {
        ignored: ["**/tests/**"],
      },
    },
    // Ensure JSON imports are properly handled
    json: {
      stringify: true,
    },
  };
});
