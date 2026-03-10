import { cwd } from "node:process";
import { Result } from "@adviser/cement";
import type { CliOutput } from "./cli-output.js";
import { findVibesJson } from "./config.js";
import { resolveTarget } from "./resolve-target.js";

export interface RunInfoOptions {
  readonly target?: string;
  readonly startDir?: string;
}

export async function runInfo(opts: RunInfoOptions, output: CliOutput): Promise<Result<void>> {
  const startDir = opts.startDir ?? cwd();
  const found = await findVibesJson(startDir);
  if (found.isErr()) return Result.Err(found.Err());

  const { path, config } = found.Ok();
  output.stdout(`vibes.json: ${path}\n`);
  output.stdout(`app:        ${config.app}\n`);

  // Only resolve fully-qualified targets (owner/app/group) without auth.
  // Bare targets need an owner from login, which isn't implemented yet.
  if (opts.target && opts.target.includes("/")) {
    const resolved = resolveTarget({ app: config.app, handle: "" }, opts.target);
    if (resolved.isErr()) return Result.Err(resolved.Err());
    output.stdout(`target:     ${resolved.Ok().full}\n`);
  } else if (opts.target) {
    output.stdout(`target:     (requires login to resolve "${opts.target}")\n`);
  }

  return Result.Ok(undefined);
}
