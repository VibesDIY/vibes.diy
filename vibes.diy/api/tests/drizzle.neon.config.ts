import { defineConfig } from "drizzle-kit";

const url = process.env.VIBES_DIY_TEST_NEON_URL;
if (!url) {
  throw new Error("VIBES_DIY_TEST_NEON_URL is required for neon drizzle-kit push");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./node_modules/@vibes.diy/api-svc/sql/vibes-diy-api-schema-pg.ts",
  out: "./dist",
  dbCredentials: { url },
});
