import { callAi, type CallAIOptions } from "call-ai";
import { isTransientError, retryWithBackoff } from "../../codegen-matrix/src/backoff.js";
import { readDevVars } from "../../codegen-matrix/src/judge.js";
import type { Dimension } from "./config.js";
import type { JudgeVerdict } from "./grade.js";
import type { AccessMatrix } from "./config.js";

export interface JudgeDeps {
  readonly call: (args: { model: string; endpoint: string; apiKey: string; prompt: string; schema: object }) => Promise<JudgeVerdict>;
  readonly model: string;
  readonly endpoint: string;
  readonly apiKey: string;
  readonly maxAttempts?: number;
}

const SCHEMA = {
  type: "object",
  properties: { secondVisitorCanAct: { type: "boolean" }, reason: { type: "string" } },
  required: ["secondVisitorCanAct", "reason"],
} as const;

export function buildJudgePrompt(o: { prompt: string; expect: Dimension; files: Record<string, string> }): string {
  return [
    `A code generator produced a multi-user app from the request: "${o.prompt}".`,
    `Expected access shape: ${o.expect}.`,
    `Judge ONE thing: after the creator uses it, can a DIFFERENT signed-in visitor perform the app's core action`,
    `(add an item / join / post / collaborate), each within the model's intended scope?`,
    `For per-visitor apps the second visitor must be able to keep THEIR OWN data (not edit the creator's).`,
    `For per-object/author-owned apps a second visitor must be able to participate (join/contribute).`,
    `Answer false ONLY if the second visitor is locked out of the core action by the access model.`,
    `\n--- access.js ---\n${o.files["access.js"] ?? "(missing)"}`,
    `\n--- App.jsx ---\n${o.files["App.jsx"] ?? "(missing)"}`,
  ].join("\n");
}

export async function judgeSecondVisitor(
  input: { prompt: string; expect: Dimension; files: Record<string, string> },
  deps: JudgeDeps,
): Promise<JudgeVerdict | null> {
  const max = deps.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await deps.call({ model: deps.model, endpoint: deps.endpoint, apiKey: deps.apiKey, prompt: buildJudgePrompt(input), schema: SCHEMA });
    } catch (e) { lastErr = e; }
  }
  void lastErr;
  return null;
}

/**
 * Parse the model's structured output into a JudgeVerdict. callAi may return the
 * raw JSON string or an already-parsed object (mirrors codegen-matrix judge.ts).
 */
function parseVerdict(raw: unknown): JudgeVerdict {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const obj = JSON.parse(text) as { secondVisitorCanAct?: unknown; reason?: unknown };
  return {
    secondVisitorCanAct: obj.secondVisitorCanAct === true,
    reason: typeof obj.reason === "string" ? obj.reason : "",
  };
}

/**
 * The real judge transport: a thin wrapper over `call-ai` that mirrors
 * `eval/codegen-matrix/src/judge.ts` — same endpoint/apiKey/schema call shape and
 * transient-error backoff (isTransientError + retryWithBackoff). The backoff here
 * wraps a single callAi attempt; judgeSecondVisitor's own attempt loop is bypassed
 * by injecting this as `call` (it throws on terminal failure, which degrades to null).
 */
const JUDGE_RETRIES = 3;

async function realCall(args: { model: string; endpoint: string; apiKey: string; prompt: string; schema: object }): Promise<JudgeVerdict> {
  const opts: CallAIOptions = {
    model: args.model,
    endpoint: args.endpoint,
    apiKey: args.apiKey,
    schema: args.schema as CallAIOptions["schema"],
  };
  const raw = await retryWithBackoff(() => callAi(args.prompt, opts), {
    retries: JUDGE_RETRIES,
    isRetryable: isTransientError,
  });
  return parseVerdict(raw);
}

/**
 * Factory resolving the judge transport the same way codegen-matrix's judge does:
 * dev-vars (LLM_BACKEND_URL/LLM_BACKEND_API_KEY) via readDevVars (env first, then
 * vibes.diy/pkg/.dev.vars), and the configured judgeModel from the matrix.
 */
export function realJudgeDeps(matrix: AccessMatrix): JudgeDeps {
  const devVars = readDevVars();
  return {
    call: realCall,
    model: matrix.judgeModel,
    endpoint: devVars.llmUrl,
    apiKey: devVars.llmKey,
    // realCall already retries transient errors internally; one judgeSecondVisitor
    // attempt is enough — a thrown error degrades the row to null.
    maxAttempts: 1,
  };
}
