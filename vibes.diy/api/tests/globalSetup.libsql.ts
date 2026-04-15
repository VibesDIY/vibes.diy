import fs from "fs/promises";
import path from "node:path";
import { $ } from "zx";
import type { TestProject } from "vitest/node";

export async function setup(project: TestProject) {
  const root = project.toJSON().serializedConfig.root;

  $.verbose = true;
  // cd(root);
  await fs.mkdir(path.join(root, "dist"), { recursive: true });
  const basePath = path.join(root, "dist", "dash-backend.sqlite");
  // Remove stale DB and WAL/SHM sidecars so each run starts fresh
  await Promise.all([
    fs.rm(basePath, { force: true }),
    fs.rm(`${basePath}-wal`, { force: true }),
    fs.rm(`${basePath}-shm`, { force: true }),
  ]);
  const dashSQLite = `file://${basePath}`;
  await $`(cd ${root} && VIBES_DIY_TEST_SQL_URL=${dashSQLite} pnpm exec drizzle-kit push --config ./drizzle.libsql.config.ts)`;

  project.provide("VIBES_DIY_TEST_SQL_URL" as never, dashSQLite as never);
  project.provide("DB_FLAVOUR" as never, "sqlite" as never);
  console.log("Provided VIBES_DIY_TEST_SQL_URL:", dashSQLite);

  return () => {
    /* */
  };
}
