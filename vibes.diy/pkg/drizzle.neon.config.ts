import { defineConfig } from "drizzle-kit";
import { dotenv } from "zx";

for (const varName of [".env.local", ".dev.vars", "../frontend/.env.local", "../frontend/.dev.vars"]) {
  try {
    dotenv.config(varName);
  } catch {
    // ignore missing files
  }
}

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  throw new Error("NEON_DATABASE_URL is not set");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./node_modules/@vibes.diy/api-svc/sql/vibes-diy-api-schema-pg.ts",
  out: "./dist",
  dbCredentials: { url },
});
