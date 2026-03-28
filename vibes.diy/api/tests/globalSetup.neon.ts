import { $ } from "zx";
import type { TestProject } from "vitest/node";
import path from "node:path";
import fs from "node:fs/promises";

async function schemaHash(schemaPath: string): Promise<string> {
  const content = await fs.readFile(schemaPath);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", content);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function setup(project: TestProject) {
  const root = project.toJSON().serializedConfig.root;
  try {
    process.loadEnvFile(path.join(root, ".env"));
  } catch {
    // .env is optional — env vars may be set externally
  }

  const neonUrl = process.env.VIBES_DIY_TEST_NEON_URL;
  if (!neonUrl) {
    throw new Error("VIBES_DIY_TEST_NEON_URL env var is required for neon tests");
  }

  const schemaFile = path.resolve(root, "node_modules/@vibes.diy/api-sql/vibes-diy-api-schema-pg.ts");
  const hashFile = path.join(root, "dist", ".neon-schema-hash");

  await fs.mkdir(path.dirname(hashFile), { recursive: true });

  const currentHash = await schemaHash(schemaFile);
  let cachedHash = "";
  try {
    cachedHash = (await fs.readFile(hashFile, "utf8")).trim();
  } catch {
    // no cached hash yet
  }

  if (currentHash !== cachedHash) {
    console.log("[neon] schema changed, running drizzle-kit push...");
    $.verbose = true;
    await $`(cd ${root} && VIBES_DIY_TEST_NEON_URL=${neonUrl} pnpm exec drizzle-kit push --config ./drizzle.neon.config.ts)`;
    await fs.writeFile(hashFile, currentHash);
  } else {
    console.log("[neon] schema unchanged, skipping drizzle-kit push");
  }

  project.provide("VIBES_DIY_TEST_NEON_URL" as never, neonUrl as never);
  project.provide("DB_FLAVOUR" as never, "pg" as never);

  return () => {
    /* */
  };
}
