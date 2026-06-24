// Used by `pnpm run drizzle:neon` (drizzle-kit push) — invoked from
// vibes.diy/actions/deploy/action.yaml on tag/main deploys and from
// .github/workflows/vibes-diy-pr-preview.yaml on PRs that touch this
// file or vibes.diy/api/sql/**. See #2601 for why preview pushes too.
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
  schema: "./node_modules/@vibes.diy/api-sql/vibes-diy-api-schema-pg.ts",
  out: "./dist",
  dbCredentials: { url },
});
