import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render enabled for Cloudflare Workers
  ssr: true,
  basename: process.env.VITE_APP_BASENAME || "/",
  // v8_viteEnvironmentApi is the default in React Router v8 (Vite 7+ Environment API),
  // so the future flag is no longer needed.
} satisfies Config;
