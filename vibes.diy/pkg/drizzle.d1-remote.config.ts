import { defineConfig } from "drizzle-kit";
import { dotenv } from "zx";
import { readFileSync } from "fs";
import { parse } from "toml";
import { join } from "path";

interface D1Database {
  binding: string;
  database_name: string;
  database_id: string;
}

interface WranglerEnvConfig {
  name?: string;
  d1_databases?: D1Database[];
}

interface WranglerConfig {
  name: string;
  d1_databases?: D1Database[];
  env?: Record<string, WranglerEnvConfig>;
}

function getD1DatabaseId(binding = "DB", configPath = "wrangler.toml"): string | undefined {
  const env = process.env.CLOUDFLARE_ENV || "dev";
  const fullPath = join(process.cwd(), configPath);

  let content: string;
  try {
    content = readFileSync(fullPath, "utf-8");
  } catch {
    return undefined;
  }

  const config = parse(content) as WranglerConfig;

  let databases: D1Database[] | undefined;

  if (env && config.env?.[env]?.d1_databases) {
    databases = config.env[env].d1_databases;
  } else {
    databases = config.d1_databases;
  }

  if (!databases || databases.length === 0) {
    return undefined;
  }

  const db = databases.find((d) => d.binding === binding);
  return db?.database_id;
}

for (const varName of [".env.local", ".dev.vars", "../frontend/.env.local", "../frontend/.dev.vars"]) {
  try {
    dotenv.config(varName);
  } catch (e) {
    console.warn(`Could not load environment variables from ${varName}`);
  }
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");
}

if (!process.env.CLOUDFLARE_D1_TOKEN && !process.env.CLOUDFLARE_API_TOKEN) {
  console.warn("CLOUDFLARE_D1_TOKEN is not set, using CLOUDFLARE_API_TOKEN instead. This may not work as expected.");
}

const databaseId = getD1DatabaseId() ?? process.env.CLOUDFLARE_DATABASE_ID;

if (!databaseId) {
  throw new Error("Database ID not found. Set CLOUDFLARE_ENV to match wrangler.toml env or set CLOUDFLARE_DATABASE_ID");
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./node_modules/@vibes.diy/api-svc/sql/vibes-diy-api-schema.ts",
  out: "./dist",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId,
    token: (process.env.CLOUDFLARE_D1_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN) as string,
  },
});
