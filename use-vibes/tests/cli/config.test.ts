import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { findVibesJson } from "../../pkg/commands/config.js";
import { assertTrue, assertContains, withTempDir } from "./test-helpers.js";

Deno.test("findVibesJson: finds config in same directory", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
    const result = await findVibesJson(dir);
    assertTrue(result.isOk(), `should find vibes.json: ${result.isErr() ? result.Err() : ""}`);
    assertTrue(result.Ok().config.app === "test-app", "app should be test-app");
    assertContains(result.Ok().path, "vibes.json", "path should contain vibes.json");
  });
});

Deno.test("findVibesJson: walks up to find config in parent", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "parent-app" }));
    const child = join(dir, "nested", "deep");
    await mkdir(child, { recursive: true });
    const result = await findVibesJson(child);
    assertTrue(result.isOk(), `should find vibes.json in parent: ${result.isErr() ? result.Err() : ""}`);
    assertTrue(result.Ok().config.app === "parent-app", "app should be parent-app");
  });
});

Deno.test("findVibesJson: errors when no vibes.json exists", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    const result = await findVibesJson(dir);
    assertTrue(result.isErr(), "should error when no vibes.json");
    assertContains(String(result.Err()), "No vibes.json found", "error should mention missing vibes.json");
  });
});

Deno.test("findVibesJson: errors when app field missing", async function (): Promise<void> {
  await withTempDir(async (dir) => {
    await writeFile(join(dir, "vibes.json"), JSON.stringify({}));
    const result = await findVibesJson(dir);
    assertTrue(result.isErr(), "should error when app field missing");
    assertContains(String(result.Err()), "app", "error should mention app field");
  });
});
