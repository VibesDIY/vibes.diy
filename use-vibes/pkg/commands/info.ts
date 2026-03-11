import { cwd } from "node:process";
import { Result } from "@adviser/cement";
import type { CliOutput } from "./cli-output-node.js";
import { findVibesJson } from "./config.js";
import { resolveTarget } from "./resolve-target.js";

export interface RunInfoOptions {
  readonly target?: string;
  readonly startDir?: string;
}

export async function runInfo(opts: RunInfoOptions, output: CliOutput): Promise<Result<void>> {
  const startDir = opts.startDir ?? cwd();
  const found = await findVibesJson(startDir);
  if (found.isErr()) return Result.Err(found);

  const { path, config } = found.Ok();
  output.stdout(`vibes.json: ${path}\n`);
  output.stdout(`app:        ${config.app}\n`);

  // Only resolve fully-qualified targets (owner/app/group) without auth.
  // Partially qualified (owner/app) or bare targets need login context.
  const slashCount = opts.target ? opts.target.split("/").length - 1 : 0;
  if (opts.target && slashCount === 2) {
    const resolved = resolveTarget({ app: config.app, handle: "" }, opts.target);
    if (resolved.isErr()) return Result.Err(resolved);
    output.stdout(`target:     ${resolved.Ok().full}\n`);
  } else if (opts.target) {
    output.stdout(`target:     (requires login to resolve "${opts.target}")\n`);
  }

  return Result.Ok(undefined);
}
