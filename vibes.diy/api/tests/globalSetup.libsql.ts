import fs from "fs/promises";
import path from "node:path";
import { $ } from "zx";
import type { TestProject } from "vitest/node";

/**
 * Create an isolated SQLite DB with the given name under dist/.
 * Runs drizzle-kit push to apply the schema. Returns the file:// URL.
 */
export async function createIsolatedDB(root: string, name: string): Promise<string> {
  await fs.mkdir(path.join(root, "dist"), { recursive: true });
  const dashSQLite = `file://${root}/dist/dash-backend-${name}.sqlite`;
  await $`(cd ${root} && VIBES_DIY_TEST_SQL_URL=${dashSQLite} pnpm exec drizzle-kit push --config ./drizzle.libsql.config.ts)`;
  return dashSQLite;
}

export async function setup(project: TestProject) {
  const root = project.toJSON().serializedConfig.root;
  $.verbose = true;

  const dashSQLite = await createIsolatedDB(root, "shared");

  project.provide("VIBES_DIY_TEST_SQL_URL" as never, dashSQLite as never);
  project.provide("DB_FLAVOUR" as never, "sqlite" as never);
  console.log("Provided VIBES_DIY_TEST_SQL_URL:", dashSQLite);

  return () => {
    /* */
  };
}
