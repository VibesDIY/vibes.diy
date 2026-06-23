export type Tier = "cheap" | "expensive";

export interface ModelEntry {
  readonly id: string;
  readonly class: string;
  readonly tier: Tier;
}

export interface MatrixConfig {
  readonly cliCommand: string;
  readonly apiUrl: string;
  /**
   * Runtime hostname base for the deployed vibe (NOT the API host — they differ
   * in preview). Screenshot host is `<appSlug>--<ownerHandle>.<runtimeHostBase>`.
   * Prod: "vibes.diy". Preview: "pr-<N>.vibespreview.dev".
   */
  readonly runtimeHostBase: string;
  readonly handle: string;
  readonly judgeModel: string;
  readonly reps: number;
  readonly screenshotTimeoutMs: number;
  readonly models: readonly ModelEntry[];
}

export interface PromptEntry {
  readonly id: string;
  readonly prompt: string;
}

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(`config: "${key}" must be a non-empty string`);
  }
  return v;
}

function reqPositiveNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new Error(`config: "${key}" must be a number > 0`);
  }
  return v;
}

export function parseMatrixConfig(text: string): MatrixConfig {
  const obj = JSON.parse(text) as Record<string, unknown>;
  const cliCommand = reqString(obj, "cliCommand");
  const apiUrl = reqString(obj, "apiUrl");
  const runtimeHostBase = reqString(obj, "runtimeHostBase");
  const handle = reqString(obj, "handle");
  const judgeModel = reqString(obj, "judgeModel");
  const reps = reqPositiveNumber(obj, "reps");
  const screenshotTimeoutMs = reqPositiveNumber(obj, "screenshotTimeoutMs");
  const rawModels = obj.models;
  if (!Array.isArray(rawModels) || rawModels.length === 0) {
    throw new Error("config: must list at least one model");
  }
  const models = rawModels.map((m, i): ModelEntry => {
    const e = m as Record<string, unknown>;
    const tier = e.tier;
    if (tier !== "cheap" && tier !== "expensive") {
      throw new Error(`config: models[${i}].tier must be "cheap" or "expensive"`);
    }
    return { id: reqString(e, "id"), class: reqString(e, "class"), tier };
  });
  return { cliCommand, apiUrl, runtimeHostBase, handle, judgeModel, reps, screenshotTimeoutMs, models };
}

export function parsePromptsJsonl(text: string): PromptEntry[] {
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line, i) => {
      const e = JSON.parse(line) as Record<string, unknown>;
      const id = e.id;
      const prompt = e.prompt;
      if (typeof id !== "string" || id.length === 0) {
        throw new Error(`prompts[${i}]: "id" must be a non-empty string`);
      }
      if (typeof prompt !== "string" || prompt.length === 0) {
        throw new Error(`prompts[${i}]: "prompt" must be a non-empty string`);
      }
      return { id, prompt };
    });
}
