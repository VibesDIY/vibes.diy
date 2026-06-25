import type { OpenRouter } from "@openrouter/agent";
import { isTransientError, retryWithBackoff } from "@vibes.diy/eval-codegen-matrix/scoring";
import type { GenResult } from "./cell.js";
import { buildPrompt } from "./prompt.js";
import { parseFiles } from "./parse-files.js";
import { buildCheck } from "./build-check.js";
import { extractCost } from "./cost.js";

/** One completion attempt. Throws on a network/SDK error so the caller can retry. */
async function runOneShotOnce(client: OpenRouter, model: string, systemPrompt: string, userPrompt: string): Promise<GenResult> {
  const { instructions, input } = buildPrompt("oneshot", systemPrompt, userPrompt);
  const result = client.callModel({ model, instructions, input });
  const text = await result.getText();
  const response = await result.getResponse();
  const { costUsd, tokens } = extractCost(response as never);
  const files = parseFiles(text);
  if (Object.keys(files).length === 0) {
    return { files, steps: 1, buildPass: false, costUsd, tokens, exitState: "no-files", note: "no files parsed from output" };
  }
  const build = await buildCheck(files);
  return { files, steps: 1, buildPass: build.ok, costUsd, tokens, exitState: "ok", note: build.ok ? "" : build.errors.join("; ") };
}

/** One completion, with transient-error retry. `retries` defaults to 2 (3 attempts). */
export async function runOneShot(client: OpenRouter, model: string, systemPrompt: string, userPrompt: string, retries = 2): Promise<GenResult> {
  try {
    return await retryWithBackoff(() => runOneShotOnce(client, model, systemPrompt, userPrompt), { retries, isRetryable: isTransientError });
  } catch (e) {
    return { files: {}, steps: 1, buildPass: false, costUsd: 0, tokens: 0, exitState: "errored", note: (e as Error).message.slice(0, 200), transient: isTransientError(e) };
  }
}
