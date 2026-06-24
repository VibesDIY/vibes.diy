import { neonConfig } from "@neondatabase/serverless";
import { defineConfig } from "drizzle-kit";

const defaultNeonWsProxy = neonConfig.wsProxy;
const defaultNeonUseSecureWebSocket = neonConfig.useSecureWebSocket;

const wsProxy = process.env.VIBES_DIY_TEST_PG_WS_PROXY;
neonConfig.wsProxy = wsProxy ? () => wsProxy : defaultNeonWsProxy;

const useSecureWs = process.env.VIBES_DIY_TEST_PG_USE_SECURE_WS;
if (useSecureWs === "0") {
  neonConfig.useSecureWebSocket = false;
} else if (useSecureWs === "1") {
  neonConfig.useSecureWebSocket = true;
} else {
  neonConfig.useSecureWebSocket = defaultNeonUseSecureWebSocket;
}

const url = process.env.VIBES_DIY_TEST_PG_URL ?? process.env.VIBES_DIY_TEST_NEON_URL;
if (!url) {
  throw new Error("VIBES_DIY_TEST_PG_URL (or VIBES_DIY_TEST_NEON_URL) is required for pg drizzle-kit push");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./node_modules/@vibes.diy/api-sql/vibes-diy-api-schema-pg.ts",
  out: "./dist",
  dbCredentials: { url },
});
