import { readFile } from "node:fs/promises";
import { Result, pathOps } from "@adviser/cement";
import { findUp } from "find-up";

export interface VibesConfig {
  readonly app: string;
  readonly targets?: Record<string, { fs?: { id: string; ts: string }[] }>;
}

export interface FoundConfig {
  readonly path: string;
  readonly config: VibesConfig;
}

export async function findVibesJson(startDir: string): Promise<Result<FoundConfig>> {
  const configPath = await findUp("vibes.json", { cwd: startDir });
  if (!configPath) {
    return Result.Err(`No vibes.json found (starting at ${pathOps.join(startDir, "vibes.json")})`);
  }

  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return Result.Err(`Invalid vibes.json at ${configPath}: expected an object`);
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.app !== "string" || obj.app === "") {
      return Result.Err(`Invalid vibes.json at ${configPath}: "app" must be a non-empty string`);
    }
    return Result.Ok({ path: configPath, config: obj as unknown as VibesConfig });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Result.Err(`Error reading ${configPath}: ${message}`);
  }
}
