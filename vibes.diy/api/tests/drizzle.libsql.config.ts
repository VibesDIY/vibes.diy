import { URI } from "@adviser/cement";
import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

let url: string;
if (process.env.VIBES_DIY_TEST_SQL_URL) {
  url = URI.from(process.env.VIBES_DIY_TEST_SQL_URL).pathname;
  console.warn("VIBES_DIY_TEST_SQL_URL set to:", url);
} else {
  url = "./dist/vibes-diy-backend.sqlite";
}

fs.mkdirSync(path.dirname(url), { recursive: true });

export default defineConfig({
  dialect: "sqlite",
  schema: "./node_modules/@vibes.diy/api-svc/sql/vibes-diy-api-schema.ts",
  out: "./dist",
  dbCredentials: { url },
});
