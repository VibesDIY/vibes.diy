import { defineConfig } from "vite";

// Basic Vite config for Storybook
export default defineConfig({
  define: {
    // Define any necessary environment variables
    "process.env.NODE_ENV": '"development"',
  },
  json: {
    stringify: true,
  },
});