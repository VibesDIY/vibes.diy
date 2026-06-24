import type { JudgeDeps } from "./judge.js";

export interface GuardrailResult {
  readonly ok: boolean;
  readonly hits: string[];
}

const ADDED = /^\+(?!\+)/; // added line in a unified diff, not the +++ header
const PROHIBITION = /\b(never|don'?t|do not|avoid|must not|should not)\b/i;
const ANTIPATTERN_NAME = /\bForm-A\b|owner-only (writes?|app)|the owner trap/i;

/**
 * Grep layer of verify gate 4. Scans the added lines of a unified diff over
 * `prompts/pkg/` and rejects edits that enumerate "never/don't…" prohibitions in
 * the access guidance, or that NAME the owner-only anti-pattern (the `489ff77`
 * lesson — naming it taught the model to reach for it). Affirmative shape->model
 * guidance passes.
 */
export function guardrailGrep(diff: string): GuardrailResult {
  const hits: string[] = [];
  for (const line of diff.split("\n")) {
    if (!ADDED.test(line)) continue;
    const text = line.slice(1);
    if (PROHIBITION.test(text)) hits.push(`prohibition: ${text.trim()}`);
    if (ANTIPATTERN_NAME.test(text)) hits.push(`anti-pattern naming: ${text.trim()}`);
  }
  return { ok: hits.length === 0, hits };
}

/** The verdict the small guardrail judge returns. */
export interface GuardrailJudgeVerdict {
  readonly affirmative: boolean;
  readonly reason: string;
}

const JUDGE_SCHEMA = {
  type: "object",
  properties: { affirmative: { type: "boolean" }, reason: { type: "string" } },
  required: ["affirmative", "reason"],
} as const;

export function buildGuardrailPrompt(diff: string): string {
  return [
    `You review edits to a code-generation system prompt's access-model guidance.`,
    `The system prompt should teach the correct access model BY AFFIRMATIVE EXAMPLE`,
    `(showing the right shape -> model mapping), NOT by enumerating prohibitions and`,
    `NOT by naming anti-patterns (naming "the owner-only trap" teaches the model to`,
    `reach for it — the 489ff77 lesson).`,
    `Judge ONE thing about the ADDED lines of this diff: does it teach by affirmative`,
    `example, or does it enumerate prohibitions / name an anti-pattern?`,
    `Answer affirmative=true ONLY if every added line teaches by affirmative example.`,
    `\n--- diff ---\n${diff}`,
  ].join("\n");
}

/**
 * Full guardrail (verify gate 4): grep first, and ONLY if grep is clean, run one
 * small injected judge call ("does this diff teach by affirmative example, or
 * enumerate prohibitions / name an anti-pattern?") and AND the verdict. If the
 * judge is unavailable (call throws), the grep verdict stands (a clean grep is not
 * vetoed by a missing judge). The judge transport reuses Task 7's `JudgeDeps`
 * pattern; the unit test exercises grep + an injected fake (no network).
 */
export async function guardrail(diff: string, judgeDeps: JudgeDeps): Promise<GuardrailResult> {
  const grep = guardrailGrep(diff);
  if (!grep.ok) return grep;

  let verdict: GuardrailJudgeVerdict | null = null;
  const max = judgeDeps.maxAttempts ?? 3;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const raw = await judgeDeps.call({
        model: judgeDeps.model,
        endpoint: judgeDeps.endpoint,
        apiKey: judgeDeps.apiKey,
        prompt: buildGuardrailPrompt(diff),
        schema: JUDGE_SCHEMA,
      });
      verdict = raw as unknown as GuardrailJudgeVerdict;
      break;
    } catch {
      verdict = null;
    }
  }

  // Judge unavailable -> the clean grep verdict stands.
  if (verdict === null) return grep;
  if (verdict.affirmative) return grep;
  return { ok: false, hits: [`judge: enumerates prohibitions / names an anti-pattern — ${verdict.reason}`] };
}
