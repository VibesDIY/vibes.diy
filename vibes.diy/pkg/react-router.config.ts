import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render enabled for Cloudflare Workers
  ssr: true,
  basename: process.env.VITE_APP_BASENAME || "/",
} satisfies Config;
