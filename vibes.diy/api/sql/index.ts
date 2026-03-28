import { D1Database } from "@cloudflare/workers-types";
import { toDBFlavour, VibesSqlite } from "./tables.js";

export * from "./tables.js";
export * as pg from "./vibes-diy-api-schema-pg.js";
export * as sqlite from "./vibes-diy-api-schema-sqlite.js";
export * from "./sql-peer.js";

import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

export function cfDrizzle<T extends VibesSqlite>(
  env: {
    DB_FLAVOUR?: string;
    NEON_DATABASE_URL?: string;
  },
  d1: D1Database,
  ctxDrizzle?: T
): { db: T } {
  if (ctxDrizzle) return { db: ctxDrizzle };
  if (toDBFlavour(env.DB_FLAVOUR) === "pg" && env.NEON_DATABASE_URL) {
    return { db: drizzleNeon(new Pool({ connectionString: env.NEON_DATABASE_URL })) as unknown as T };
  }
  return { db: drizzleD1(d1) as unknown as T };
}
