import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findVibesJson } from "../../pkg/commands/config.js";
import { withTempDir } from "./test-helpers.js";

describe("findVibesJson", () => {
  it("finds config in same directory", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "test-app" }));
      const result = await findVibesJson(dir);
      expect(result.isOk()).toBe(true);
      expect(result.Ok().config.app).toBe("test-app");
      expect(result.Ok().path).toContain("vibes.json");
    });
  });

  it("walks up to find config in parent", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({ app: "parent-app" }));
      const child = join(dir, "nested", "deep");
      await mkdir(child, { recursive: true });
      const result = await findVibesJson(child);
      expect(result.isOk()).toBe(true);
      expect(result.Ok().config.app).toBe("parent-app");
    });
  });

  it("errors when no vibes.json exists", async () => {
    await withTempDir(async (dir) => {
      const result = await findVibesJson(dir);
      expect(result.isErr()).toBe(true);
      expect(String(result.Err())).toContain("No vibes.json found");
    });
  });

  it("errors when app field missing", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "vibes.json"), JSON.stringify({}));
      const result = await findVibesJson(dir);
      expect(result.isErr()).toBe(true);
      expect(String(result.Err())).toContain("app");
    });
  });
});
