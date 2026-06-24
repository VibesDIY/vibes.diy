// @openrouter/agent's `tool()` expects a Zod v4 core schema (`$ZodObject` with the
// `_zod` brand). The workspace resolves zod 3.25.x, whose v4 API lives at the
// `zod/v4` subpath — import `z` from there so `inputSchema` matches the SDK's overload.
import { z } from "zod/v4";
import { tool } from "@openrouter/agent/tool";
import { stepCountIs, maxCost } from "@openrouter/agent/stop-conditions";
import type { OpenRouter } from "@openrouter/agent";
import type { GenResult } from "./cell.js";
import { buildPrompt } from "./prompt.js";
import { buildCheck } from "./build-check.js";
import { evaluateProgress } from "./feedback.js";
import { extractCost } from "./cost.js";

/**
 * The write_file executor: writes into the shared `files` map, runs the
 * build + structural check, and returns the result the model reacts to. Pure
 * w.r.t. the SDK (no network), so the loop's accept/iterate logic is testable
 * with a fake driver.
 */
export function makeWriteFileExecutor(
  files: Record<string, string>,
  getNeedsAccess: () => boolean
): (args: { path: string; contents: string }) => Promise<{ ok: boolean; feedback: string }> {
  return async ({ path, contents }) => {
    files[path] = contents;
    const build = await buildCheck(files);
    const { clean, message } = evaluateProgress(files, build, getNeedsAccess());
    return { ok: clean, feedback: message };
  };
}

export async function runAgentic(
  client: OpenRouter,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  opts: { maxSteps: number; maxCostUsd: number; needsAccess: boolean }
): Promise<GenResult> {
  const files: Record<string, string> = {};
  let steps = 0;
  const exec = makeWriteFileExecutor(files, () => opts.needsAccess);
  const writeFileConfig = {
    name: "write_file",
    description: "Write a complete file (App.jsx or access.js). Returns a build + structural check; fix problems by calling again.",
    inputSchema: z.object({ path: z.string(), contents: z.string() }),
    execute: async (args: { path: string; contents: string }) => {
      steps++;
      return exec(args);
    },
  };
  // The SDK's `tool()` is typed against a genuine zod@4 `$ZodObject`, but this
  // package resolves zod 3.25.x's `zod/v4` shim. The two are runtime-compatible
  // (3.25's `zod/v4` schemas ARE v4 schemas the SDK accepts) yet nominally
  // distinct at the type level (internal `version.minor` 0 vs 4), so the config
  // is bridged through the tool-config parameter type here. The config literal
  // above is still type-checked against the typed `execute` signature.
  const writeFile = tool(writeFileConfig as unknown as Parameters<typeof tool>[0]);
  const { instructions, input } = buildPrompt("agentic", systemPrompt, userPrompt);
  try {
    const result = client.callModel({
      model,
      instructions,
      input,
      tools: [writeFile],
      stopWhen: [stepCountIs(opts.maxSteps), maxCost(opts.maxCostUsd)],
    });
    await result.getText();
    const response = await result.getResponse();
    const { costUsd, tokens } = extractCost(response as never);
    if (Object.keys(files).length === 0) {
      return { files, steps, buildPass: false, costUsd, tokens, exitState: "no-files", note: "model wrote no files" };
    }
    const build = await buildCheck(files);
    return { files, steps, buildPass: build.ok, costUsd, tokens, exitState: "ok", note: build.ok ? "" : build.errors.join("; ") };
  } catch (e) {
    return { files, steps, buildPass: false, costUsd: 0, tokens: 0, exitState: "errored", note: (e as Error).message.slice(0, 200) };
  }
}
