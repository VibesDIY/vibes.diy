import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runInfo } from "../../pkg/commands/info.js";
import { runCli, makeTestRuntime, withTempDir } from "./test-helpers.js";

describe("info", () => {
  it("shows config when vibes.json present", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
      const t = makeTestRuntime({ cwd: dir });
      const result = await runInfo({}, t.runtime);
      expect(result.isOk()).toBe(true);
      expect(t.stdout()).toContain("test-app");
      expect(t.stdout()).toContain("vibes.json");
    });
  });

  it("bare target shows requires login", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
      const t = makeTestRuntime({ cwd: dir });
      const result = await runInfo({ target: "dev" }, t.runtime);
      expect(result.isOk()).toBe(true);
      expect(t.stdout()).toContain("requires login");
    });
  });

  it("fully qualified target resolves", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
      const t = makeTestRuntime({ cwd: dir });
      const result = await runInfo({ target: "alice/soup/team" }, t.runtime);
      expect(result.isOk()).toBe(true);
      expect(t.stdout()).toContain("alice/soup/team");
    });
  });

  it("errors when no vibes.json", async () => {
    await withTempDir(async (dir) => {
      const t = makeTestRuntime({ cwd: dir });
      const result = await runInfo({}, t.runtime);
      expect(result.isErr()).toBe(true);
    });
  });

  it("error result propagates from missing config", async () => {
    await withTempDir(async (dir) => {
      const t = makeTestRuntime({ cwd: dir });
      const result = await runInfo({}, t.runtime);
      expect(result.isErr()).toBe(true);
      expect(String(result.Err())).toContain("No vibes.json found");
    });
  });
});

describe("info integration", () => {
  it("info with vibes.json exits 0", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "smoke-app" }));
      const result = await runCli(["info"], { cwd: dir });
      expect(result.code).toBe(0);
      expect(result.stdout).toContain("smoke-app");
    });
  });

  it("info without vibes.json exits 1", async () => {
    await withTempDir(async (dir) => {
      const result = await runCli(["info"], { cwd: dir });
      expect(result.code).toBe(1);
    });
  });

  it("info with extra args exits 1", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test" }));
      const result = await runCli(["info", "target", "extra"], { cwd: dir });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain("at most one");
    });
  });
});
