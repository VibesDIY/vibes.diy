import fs from "fs/promises";
import path from "node:path";
import { $ } from "zx";
import type { TestProject } from "vitest/node";

export async function setup(project: TestProject) {
  // globalSetup runs once per project (not per test file / worker). Time the
  // drizzle-kit push — the one-time DB schema cost — and the total, so the
  // pre-run instrumentation can show how much of CI is fixed setup overhead.
  // See agents/flaky-tests.md § pre-run instrumentation.
  const t0 = Date.now();
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
  const tPush = Date.now();
  await $`(cd ${root} && VIBES_DIY_TEST_SQL_URL=${dashSQLite} pnpm exec drizzle-kit push --config ./drizzle.libsql.config.ts)`;
  const pushSecs = ((Date.now() - tPush) / 1000).toFixed(1);

  project.provide("VIBES_DIY_TEST_SQL_URL" as never, dashSQLite as never);
  project.provide("DB_FLAVOUR" as never, "sqlite" as never);
  console.log("Provided VIBES_DIY_TEST_SQL_URL:", dashSQLite);
  console.log(`[globalSetup api-tests] drizzle-kit push ${pushSecs}s; total ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  return () => {
    /* */
  };
}
