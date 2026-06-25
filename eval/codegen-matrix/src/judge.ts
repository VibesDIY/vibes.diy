import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { callAi, type CallAIOptions, type Message } from "call-ai";
import type { JudgeResult, DesignResult } from "./cell.js";
import { isTransientError, retryWithBackoff } from "./backoff.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEV_VARS = resolve(__dirname, "../../../vibes.diy/pkg/.dev.vars");

/** Retries transient judge-backend errors (429/5xx/network) with exponential backoff. */
const JUDGE_RETRIES = 3;

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

/**
 * Resolve the judge transport from env vars first (how the cloud agent env
 * provides them), falling back to a local `.dev.vars` file. Pure, so the
 * precedence is unit-testable. `fileText` is undefined when no file exists.
 */
export function resolveDevVars(env: NodeJS.ProcessEnv, fileText: string | undefined): DevVars {
  const llmUrl = env.LLM_BACKEND_URL?.trim();
  const llmKey = env.LLM_BACKEND_API_KEY?.trim();
  if (llmUrl && llmKey) return { llmUrl, llmKey };
  if (fileText !== undefined) return parseDevVars(fileText);
  throw new Error(
    "LLM_BACKEND_URL / LLM_BACKEND_API_KEY not found — set them as environment variables " +
      "(cloud agent env) or in vibes.diy/pkg/.dev.vars (local dev)"
  );
}

export function readDevVars(): DevVars {
  const fileText = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, "utf-8") : undefined;
  return resolveDevVars(process.env, fileText);
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

export function parseJudge(raw: unknown): { score: number | null; reason: string } {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  try {
    const obj = JSON.parse(text) as { score?: unknown; reason?: unknown };
    return { score: clampScore(obj.score), reason: typeof obj.reason === "string" ? obj.reason : "" };
  } catch {
    const trimmed = text.trim();
    const looksHtml = /^<(!doctype|html)/i.test(trimmed);
    const hint =
      looksHtml || trimmed.length === 0
        ? "judge returned non-JSON (HTML/empty) — check LLM_BACKEND_URL includes /chat/completions"
        : `judge returned unparseable output: ${trimmed.slice(0, 120)}`;
    return { score: null, reason: hint };
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
    const raw = await retryWithBackoff(() => callAi(buildFeaturePrompt(userPrompt, files), opts), {
      retries: JUDGE_RETRIES,
      isRetryable: isTransientError,
    });
    const { score, reason } = parseJudge(raw);
    return { score, reason, judgeModel: deps.judgeModel };
  } catch (e) {
    return { score: null, reason: `judge call failed: ${(e as Error).message}`, judgeModel: deps.judgeModel };
  }
}

/**
 * One trivial judge call to confirm the transport is reachable and returns
 * parseable JSON. Throws an actionable error if the judge yields a null score
 * (e.g. LLM_BACKEND_URL missing /chat/completions) so the score stage can fail
 * fast instead of producing an all-null report.
 */
export async function assertJudgeReachable(deps: JudgeDeps): Promise<void> {
  const probe = await judgeFeature(
    "Score whether the app fulfils 'hello world'.",
    { "App.jsx": "export default () => <h1>hi</h1>;" },
    deps
  );
  if (probe.score === null) {
    throw new Error(
      `judge preflight failed (${probe.reason}). Check LLM_BACKEND_URL (needs the full ` +
        `https://openrouter.ai/api/v1/chat/completions path) and LLM_BACKEND_API_KEY.`
    );
  }
}

export async function judgeDesign(userPrompt: string, imageDataUrl: string, deps: JudgeDeps): Promise<DesignResult> {
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
    const raw = await retryWithBackoff(() => callAi(messages, opts), {
      retries: JUDGE_RETRIES,
      isRetryable: isTransientError,
    });
    const { score, reason } = parseJudge(raw);
    return { available: true, score, reason, judgeModel: deps.judgeModel };
  } catch (e) {
    return { available: true, score: null, reason: `design judge failed: ${(e as Error).message}`, judgeModel: deps.judgeModel };
  }
}
