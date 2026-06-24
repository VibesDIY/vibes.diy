import { $ } from "zx";
import type { TestProject } from "vitest/node";
import path from "node:path";
import fs from "node:fs/promises";

async function hashHex(content: Uint8Array): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", content);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fileHash(filePath: string): Promise<string> {
  return hashHex(await fs.readFile(filePath));
}

async function textHash(value: string): Promise<string> {
  return hashHex(new TextEncoder().encode(value));
}

export async function setup(project: TestProject) {
  const root = project.toJSON().serializedConfig.root;
  try {
    process.loadEnvFile(path.join(root, ".env"));
  } catch {
    // .env is optional — env vars may be set externally
  }

  const pgUrl = process.env.VIBES_DIY_TEST_PG_URL ?? process.env.VIBES_DIY_TEST_NEON_URL;
  if (!pgUrl) {
    throw new Error("VIBES_DIY_TEST_PG_URL (or VIBES_DIY_TEST_NEON_URL) env var is required for pg tests");
  }
  const forceSchemaPush = process.env.VIBES_DIY_TEST_PG_FORCE_SCHEMA_PUSH === "1";

  const schemaFile = path.resolve(root, "node_modules/@vibes.diy/api-sql/vibes-diy-api-schema-pg.ts");
  const hashFile = path.join(root, "dist", ".neon-schema-hash");

  await fs.mkdir(path.dirname(hashFile), { recursive: true });

  const currentHash = await fileHash(schemaFile);
  const currentTargetHash = await textHash(pgUrl);
  const currentCacheKey = `${currentHash}:${currentTargetHash}`;
  let cachedHash = "";
  try {
    cachedHash = (await fs.readFile(hashFile, "utf8")).trim();
  } catch {
    // no cached hash yet
  }

  if (forceSchemaPush || currentCacheKey !== cachedHash) {
    const reason = forceSchemaPush ? "force-push requested via VIBES_DIY_TEST_PG_FORCE_SCHEMA_PUSH=1" : "schema/db target changed";
    console.log(`[pg-tests] ${reason}, running drizzle-kit push...`);
    $.verbose = true;
    await $`(cd ${root} && VIBES_DIY_TEST_PG_URL=${pgUrl} VIBES_DIY_TEST_NEON_URL=${pgUrl} pnpm exec drizzle-kit push --config ./drizzle.neon.config.ts)`;
    await fs.writeFile(hashFile, currentCacheKey);
  } else {
    console.log("[pg-tests] schema + db target unchanged, skipping drizzle-kit push");
  }

  project.provide("VIBES_DIY_TEST_PG_URL" as never, pgUrl as never);
  project.provide("VIBES_DIY_TEST_NEON_URL" as never, pgUrl as never);
  project.provide("DB_FLAVOUR" as never, "pg" as never);

  return () => {
    /* */
  };
}
