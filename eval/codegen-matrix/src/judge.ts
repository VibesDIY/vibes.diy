import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callAi, type CallAIOptions, type Message } from "call-ai";
import type { JudgeResult, DesignResult } from "./cell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_VARS = resolve(__dirname, "../../../vibes.diy/pkg/.dev.vars");

export interface DevVars {
  readonly llmUrl: string;
  readonly llmKey: string;
}

export function parseDevVars(text: string): DevVars {
  const llmUrl = text.match(/^LLM_BACKEND_URL=(.+)$/m)?.[1]?.trim();
  const llmKey = text.match(/^LLM_BACKEND_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!llmUrl || !llmKey) {
    throw new Error(`LLM_BACKEND_URL / LLM_BACKEND_API_KEY missing in .dev.vars`);
  }
  return { llmUrl, llmKey };
}

export function readDevVars(): DevVars {
  return parseDevVars(readFileSync(DEV_VARS, "utf-8"));
}

const JUDGE_SCHEMA = {
  properties: {
    score: { type: "integer", description: "1 (poor) to 5 (excellent)" },
    reason: { type: "string", description: "one-line justification" },
  },
  required: ["score", "reason"],
};

export function buildFeaturePrompt(userPrompt: string, files: Readonly<Record<string, string>>): string {
  const app = files["App.jsx"] ?? files["/App.jsx"] ?? "";
  const access = files["access.js"] ?? files["/access.js"];
  const accessBlock = access ? `\n\n--- access.js ---\n${access}` : "";
  return [
    "You are grading whether a generated app fulfils the request. Score 1-5:",
    "5 = every requested feature is implemented and wired; 1 = the request is essentially unmet.",
    "",
    `REQUEST:\n${userPrompt}`,
    "",
    `--- App.jsx ---\n${app}${accessBlock}`,
  ].join("\n");
}

export function buildDesignPrompt(userPrompt: string): string {
  return [
    "You are grading the visual design quality of a screenshot of a generated web app. Score 1-5 on:",
    "layout, visual hierarchy, contrast/readability, overall polish, and adherence to a no-emoji icon style.",
    "5 = clean, considered, production-feeling; 1 = broken/unstyled.",
    "",
    `The app was generated from this request:\n${userPrompt}`,
  ].join("\n");
}

function clampScore(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function parseJudge(raw: unknown): { score: number | null; reason: string } {
  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const obj = JSON.parse(text) as { score?: unknown; reason?: unknown };
    return { score: clampScore(obj.score), reason: typeof obj.reason === "string" ? obj.reason : "" };
  } catch {
    return { score: null, reason: "judge returned unparseable output" };
  }
}

export interface JudgeDeps {
  readonly devVars: DevVars;
  readonly judgeModel: string;
}

export async function judgeFeature(
  userPrompt: string,
  files: Readonly<Record<string, string>>,
  deps: JudgeDeps
): Promise<JudgeResult> {
  const opts: CallAIOptions = {
    model: deps.judgeModel,
    endpoint: deps.devVars.llmUrl,
    apiKey: deps.devVars.llmKey,
    schema: { ...JUDGE_SCHEMA, required: [...JUDGE_SCHEMA.required] },
  };
  try {
    const raw = await callAi(buildFeaturePrompt(userPrompt, files), opts);
    const { score, reason } = parseJudge(raw);
    return { score, reason, judgeModel: deps.judgeModel };
  } catch (e) {
    return { score: null, reason: `judge call failed: ${(e as Error).message}`, judgeModel: deps.judgeModel };
  }
}

export async function judgeDesign(
  userPrompt: string,
  imageDataUrl: string,
  deps: JudgeDeps
): Promise<DesignResult> {
  const opts: CallAIOptions = {
    model: deps.judgeModel,
    endpoint: deps.devVars.llmUrl,
    apiKey: deps.devVars.llmKey,
    schema: { ...JUDGE_SCHEMA, required: [...JUDGE_SCHEMA.required] },
  };
  // OpenAI/OpenRouter multimodal message shape: a text part + an image_url part.
  const messages: Message[] = [
    {
      role: "user",
      content: [
        { type: "text", text: buildDesignPrompt(userPrompt) },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];
  try {
    const raw = await callAi(messages, opts);
    const { score, reason } = parseJudge(raw);
    return { available: true, score, reason, judgeModel: deps.judgeModel };
  } catch (e) {
    return { available: true, score: null, reason: `design judge failed: ${(e as Error).message}`, judgeModel: deps.judgeModel };
  }
}
