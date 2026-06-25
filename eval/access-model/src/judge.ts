import { callAi, type CallAIOptions } from "call-ai";
import { isTransientError, retryWithBackoff } from "../../codegen-matrix/src/backoff.js";
import { readDevVars } from "../../codegen-matrix/src/judge.js";
import type { AccessMatrix, Dimension } from "./config.js";
import type { JudgeVerdict } from "./grade.js";
import type { ConsentVerdict } from "./grade-consent.js";

export interface JudgeDeps {
  readonly call: (args: {
    model: string;
    endpoint: string;
    apiKey: string;
    prompt: string;
    schema: object;
    // Returns the model's raw structured output; each caller parses it into its
    // OWN verdict shape (judgeSecondVisitor -> JudgeVerdict, guardrail -> {affirmative}).
    // Returning JudgeVerdict here would force the second-visitor shape on every caller.
  }) => Promise<unknown>;
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
  deps: JudgeDeps
): Promise<JudgeVerdict | null> {
  const max = deps.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return parseVerdict(
        await deps.call({
          model: deps.model,
          endpoint: deps.endpoint,
          apiKey: deps.apiKey,
          prompt: buildJudgePrompt(input),
          schema: SCHEMA,
        })
      );
    } catch (e) {
      lastErr = e;
    }
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

const CONSENT_SCHEMA = {
  type: "object",
  properties: {
    hasConsentPath: { type: "boolean" },
    accessLeakedWithoutConsent: { type: "boolean" },
    reason: { type: "string" },
  },
  required: ["hasConsentPath", "accessLeakedWithoutConsent", "reason"],
} as const;

/**
 * The consent-centric judge prompt (#2631 rubric refinement). Deliberately
 * shape-agnostic: it never asks which access shape the generator picked, because
 * letting users invite collaborators into part of an object graph is always
 * legitimate. It asks two consent questions only.
 */
export function buildConsentJudgePrompt(o: { prompt: string; expect: Dimension; files: Record<string, string> }): string {
  return [
    `A code generator produced a multi-user app from the request: "${o.prompt}".`,
    `Judge the access model on TWO consent questions ONLY. Do NOT judge which access "shape" it chose —`,
    `letting users invite collaborators into part of an object graph is always allowed, for any app.`,
    `1. hasConsentPath: after the creator uses it, does a DIFFERENT signed-in visitor have a path that`,
    `   respects consent — they can EITHER start their OWN data/graph immediately, OR request to join and`,
    `   be approved by the creator or an existing member? Answer false ONLY if a second visitor is at a`,
    `   true dead-end: cannot start their own AND cannot request access.`,
    `2. accessLeakedWithoutConsent: does the model let a visitor read, edit, or delete data ANOTHER user`,
    `   owns — or auto-join a private object / membership — WITHOUT the owner/creator or an existing member`,
    `   consenting? Examples that ARE leaks: a doc type with no author check so anyone can overwrite someone`,
    `   else's doc; a share/grant that adds a non-member with no approver; auto-granting a stranger a role on`,
    `   someone else's object. NOT a leak: a public or shared channel where each visitor only authors and`,
    `   edits THEIR OWN docs (the normal author-owned wall/guestbook/feed shape) — public read or`,
    `   write-your-own is fine. Answer true ONLY for access to OTHERS' data or membership granted without consent.`,
    `\n--- access.js ---\n${o.files["access.js"] ?? "(missing)"}`,
    `\n--- App.jsx ---\n${o.files["App.jsx"] ?? "(missing)"}`,
  ].join("\n");
}

export async function judgeConsent(
  input: { prompt: string; expect: Dimension; files: Record<string, string> },
  deps: JudgeDeps
): Promise<ConsentVerdict | null> {
  const max = deps.maxAttempts ?? 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return parseConsentVerdict(
        await deps.call({
          model: deps.model,
          endpoint: deps.endpoint,
          apiKey: deps.apiKey,
          prompt: buildConsentJudgePrompt(input),
          schema: CONSENT_SCHEMA,
        })
      );
    } catch (e) {
      lastErr = e;
    }
  }
  void lastErr;
  return null;
}

function parseConsentVerdict(raw: unknown): ConsentVerdict {
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const obj = JSON.parse(text) as { hasConsentPath?: unknown; accessLeakedWithoutConsent?: unknown; reason?: unknown };
  return {
    hasConsentPath: obj.hasConsentPath === true,
    accessLeakedWithoutConsent: obj.accessLeakedWithoutConsent === true,
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

async function realCall(args: {
  model: string;
  endpoint: string;
  apiKey: string;
  prompt: string;
  schema: object;
}): Promise<unknown> {
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
  // Return the parsed object verbatim; the caller coerces to its own verdict shape.
  return typeof raw === "string" ? JSON.parse(raw) : raw;
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
