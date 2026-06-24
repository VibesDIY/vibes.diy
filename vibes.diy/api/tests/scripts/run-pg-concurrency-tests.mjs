import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const requiredSuites = ["put-doc-concurrency.test.ts"];
const optionalSuites = ["apps-release-seq-concurrency.test.ts"];

const missingRequired = requiredSuites.filter((file) => !existsSync(path.resolve(process.cwd(), file)));
if (missingRequired.length > 0) {
  console.error(`[pg-concurrency] missing required suite(s): ${missingRequired.join(", ")}`);
  process.exit(1);
}

const discoveredOptional = optionalSuites.filter((file) => existsSync(path.resolve(process.cwd(), file)));
const suitesToRun = [...requiredSuites, ...discoveredOptional];

console.log(`[pg-concurrency] running suites: ${suitesToRun.join(", ")}`);
if (discoveredOptional.length !== optionalSuites.length) {
  const missingOptional = optionalSuites.filter((file) => !discoveredOptional.includes(file));
  console.log(`[pg-concurrency] optional suite(s) not present yet: ${missingOptional.join(", ")}`);
}

const result = spawnSync("vitest", ["--run", "--config", "./vitest.config.neon.ts", ...suitesToRun], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
