import { Hono, Context } from "hono";
import { getImportMapJson } from "@vibes.diy/hosting-base/config/library-import-map";

interface Bindings {
  // No bindings needed - config deployed as code
}

const app = new Hono<{ Bindings: Bindings }>();

// Serve import map with caching
app.get("/importmap.json", async (c: Context) => {
  const importMap = getImportMapJson();

  return new Response(importMap, {
    status: 200,
    headers: {
      "Content-Type": "application/importmap+json",
      "Cache-Control": "public, max-age=3600, s-maxage=86400", // 1hr browser, 24hr CDN
      "Access-Control-Allow-Origin": "*",
    },
  });
});

export default app;
