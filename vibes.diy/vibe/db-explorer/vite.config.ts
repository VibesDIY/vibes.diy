import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5199 },
  build: {
    outDir: "dist",
    // rollupOptions: {
    //   output: {
    //     manualChunks: {
    //       "ag-grid": ["ag-grid-community", "ag-grid-react"],
    //     },
    //   },
    // },
  },
});
