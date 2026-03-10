import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { Result } from "@adviser/cement";

export interface VibesConfig {
  readonly app: string;
  readonly targets?: Record<string, { fs?: { id: string; ts: string }[] }>;
}

export interface FoundConfig {
  readonly path: string;
  readonly config: VibesConfig;
}

export async function findVibesJson(startDir: string): Promise<Result<FoundConfig>> {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, "vibes.json");
    try {
      const raw = await readFile(candidate, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return Result.Err(`Invalid vibes.json at ${candidate}: expected an object`);
      }
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.app !== "string" || obj.app === "") {
        return Result.Err(`Invalid vibes.json at ${candidate}: "app" must be a non-empty string`);
      }
      return Result.Ok({ path: candidate, config: obj as unknown as VibesConfig });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "ENOENT") {
        const parent = dirname(dir);
        if (parent === dir) {
          return Result.Err("No vibes.json found (searched up to filesystem root)");
        }
        dir = parent;
        continue;
      }
      return Result.Err(`Error reading ${candidate}: ${err}`);
    }
  }
}
