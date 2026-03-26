import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "ui",
  base: "/.stable-entry/",
  plugins: [react()],
  build: {
    outDir: "dist/.stable-entry",
  },
});
