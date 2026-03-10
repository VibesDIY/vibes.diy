import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { Result, exception2Result } from "@adviser/cement";
import { type } from "arktype";

const VibesJsonType = type({
  app: "string > 0",
  "targets?": "Record<string, unknown>",
});

export type VibesConfig = typeof VibesJsonType.infer;

export interface FoundConfig {
  readonly path: string;
  readonly config: VibesConfig;
}

export async function findVibesJson(startDir: string): Promise<Result<FoundConfig>> {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, "vibes.json");

    const readResult = await exception2Result(() => readFile(candidate, "utf-8"));
    if (readResult.isErr()) {
      const err = readResult.Err();
      if (typeof err === "object" && err !== null && "code" in err && err.code === "ENOENT") {
        const parent = dirname(dir);
        if (parent === dir) {
          return Result.Err("No vibes.json found (searched up to filesystem root)");
        }
        dir = parent;
        continue;
      }
      return Result.Err(`Error reading ${candidate}: ${err}`);
    }

    const parseResult = exception2Result(() => JSON.parse(readResult.Ok()));
    if (parseResult.isErr()) {
      return Result.Err(`Invalid JSON in ${candidate}: ${parseResult.Err()}`);
    }

    const validated = VibesJsonType(parseResult.Ok());
    if (validated instanceof type.errors) {
      return Result.Err(`Invalid vibes.json at ${candidate}: ${validated.summary}`);
    }

    return Result.Ok({ path: candidate, config: validated });
  }
}
