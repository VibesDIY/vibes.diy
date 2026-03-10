import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { runInfo } from "../../pkg/commands/info.js";
import { assertTrue, assertContains, captureOutput, spawnCli, withTempDir } from "./test-helpers.js";

// --- unit tests ---

Deno.test("info: shows config when vibes.json present", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
    const captured = captureOutput();
    const result = await runInfo({ startDir: dir }, captured.output);
    assertTrue(result.isOk(), `info should succeed: ${result.isErr() ? result.Err() : ""}`);
    assertContains(captured.stdout(), "test-app", "output should contain app name");
    assertContains(captured.stdout(), "vibes.json", "output should contain vibes.json path");
  });
});

Deno.test("info: bare target shows requires login", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
    const captured = captureOutput();
    const result = await runInfo({ startDir: dir, target: "dev" }, captured.output);
    assertTrue(result.isOk(), `info should succeed: ${result.isErr() ? result.Err() : ""}`);
    assertContains(captured.stdout(), "requires login", "bare target should show requires login");
  });
});

Deno.test("info: fully qualified target resolves", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
    const captured = captureOutput();
    const result = await runInfo({ startDir: dir, target: "alice/soup/team" }, captured.output);
    assertTrue(result.isOk(), `info should succeed: ${result.isErr() ? result.Err() : ""}`);
    assertContains(captured.stdout(), "alice/soup/team", "fully qualified target should resolve");
  });
});

Deno.test("info: errors when no vibes.json", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    const captured = captureOutput();
    const result = await runInfo({ startDir: dir }, captured.output);
    assertTrue(result.isErr(), "info should error without vibes.json");
  });
});

// --- smoke tests ---

Deno.test("smoke: info with vibes.json exits 0", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "smoke-app" }));
    const result = await spawnCli(["info"], { cwd: dir });
    assertTrue(result.code === 0, `info should exit 0, got ${result.code}\nstderr: ${result.stderr}`);
    assertContains(result.stdout, "smoke-app", "output should contain app name");
  });
});

Deno.test("smoke: info without vibes.json exits 1", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    const result = await spawnCli(["info"], { cwd: dir });
    assertTrue(result.code === 1, `info should exit 1 without vibes.json, got ${result.code}`);
  });
});

Deno.test("smoke: info with extra args exits 1", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test" }));
    const result = await spawnCli(["info", "target", "extra"], { cwd: dir });
    assertTrue(result.code === 1, `info with extra args should exit 1, got ${result.code}`);
    assertContains(result.stderr, "at most one", "should report too many args");
  });
});
