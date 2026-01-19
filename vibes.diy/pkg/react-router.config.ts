import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render enabled for Cloudflare Workers
  ssr: true,
  basename: process.env.VITE_APP_BASENAME || "/",
  future: {
    v8_viteEnvironmentApi: true, // Required for Cloudflare Vite plugin
  },
} satisfies Config;
