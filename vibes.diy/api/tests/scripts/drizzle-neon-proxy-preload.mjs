import { neonConfig } from "@neondatabase/serverless";

const wsProxy = process.env.VIBES_DIY_TEST_PG_WS_PROXY;
if (wsProxy) {
  neonConfig.wsProxy = wsProxy;
}

const useSecureWs = process.env.VIBES_DIY_TEST_PG_USE_SECURE_WS;
if (useSecureWs === "0") {
  neonConfig.useSecureWebSocket = false;
} else if (useSecureWs === "1") {
  neonConfig.useSecureWebSocket = true;
}
