import { Result } from "@adviser/cement";
import { type ChatMessage, type LLMRequest } from "@vibes.diy/call-ai-v2";

// Pure helpers for the apply-error recovery orchestrator. The wire-level
// orchestration (abort upstream + splice continuation events) lives in
// prompt-chat-section.ts; everything testable lives here.
//
// Per-block apply lives in `createStreamingResolver` (in
// `prompt-chat-section.ts`). The orchestrator consumes its return value;
// nothing in this file re-runs parseFenceBody or applyEdits.
//
// Continue mode ("you were here, continue"): the recovery prompt does NOT
// surface the failure to the model. It contains current file state plus
// (optionally) the assistant's own captured partial output, truncated to
// the last successful code.end. The model continues its own narration as
// if it had not been interrupted; the failed edit is implicit in the
// difference between what its narration announced and what's in vfs.

const MAX_RECOVERY_FILE_BYTES = 16_000;
const MAX_RECOVERY_TOTAL_BYTES = 32_000;

export interface RecoveryRequestInput {
  readonly originalRequest: LLMRequest;
  readonly recoveryAddendum: string;
  readonly vfs: ReadonlyMap<string, string>;
  // Path to render first in CURRENT FILES — usually the file the model was
  // working on when the apply error occurred. Used purely for ordering;
  // the prompt does not name it as "the failed file."
  readonly focusPath: string;
  // The model's own raw upstream output captured before the abort, truncated
  // to the last successful block.code.end. Empty / omitted means we have no
  // partial to inject (e.g. abort happened before any block closed cleanly).
  readonly assistantPartial?: string;
}

// Compose the continuation LLM request. The recovery addendum + CURRENT
// FILES block is *merged into the original system message* rather than
// appended as a second system message — many providers (including some
// OpenRouter relays) reject back-to-back system messages with 400. If the
// original request has no system message, a new one is prepended.
//
// The captured assistant partial (when present) is appended as a USER
// message wrapped in "PARTIAL ASSISTANT OUTPUT" framing rather than as an
// assistant prefill. Bedrock-routed Claude rejects conversations that end
// in an assistant turn ("This model does not support assistant message
// prefill. The conversation must end with a user message."), and this
// framing works equally well on providers that DO support prefill.
//
// Shape:
//   - original = [system, ...rest], no partial:    [system+recovery, ...rest]
//   - original = [system, ...rest], with partial:  [system+recovery, ...rest, user-partial]
//   - original = [user, ...],       no partial:    [system-new, user, ...]
//   - original = [user, ...],       with partial:  [system-new, user, ..., user-partial]
//
// The merged system message is `${original}\n\n${addendum}\n\n${CURRENT FILES}` —
// no failure framing, no failed-search bytes, no SEARCH/REPLACE syntax.
export function buildRecoveryRequest({
  originalRequest,
  recoveryAddendum,
  vfs,
  focusPath,
  assistantPartial,
}: RecoveryRequestInput): Result<LLMRequest> {
  if (recoveryAddendum.length === 0) {
    return Result.Err("recovery addendum is empty");
  }
  if (focusPath.length === 0) {
    return Result.Err("focus path is empty");
  }
  const filesBlock = renderCurrentFiles(vfs, focusPath);
  const recoverySuffix = `${recoveryAddendum}\n\n${filesBlock}`;
  const messages = mergeRecoveryIntoSystem(originalRequest.messages, recoverySuffix);
  if (assistantPartial !== undefined && assistantPartial.length > 0) {
    messages.push({
      role: "user",
      content: [{ type: "text", text: renderPartialResume(assistantPartial) }],
    });
  }
  return Result.Ok({ ...originalRequest, messages });
}

// Wrap the captured partial in a user-framed resume message. The prose
// makes it explicit that the bytes are the assistant's own prior output
// (so the model picks up its narration where it stopped) without ending
// the conversation on an assistant turn.
function renderPartialResume(assistantPartial: string): string {
  return [
    "PARTIAL ASSISTANT OUTPUT (your own output so far this turn, truncated to the last clean code block):",
    "",
    assistantPartial,
    "",
    "Continue from where the partial output above stopped. Do not repeat any code block already shown above.",
  ].join("\n");
}

function mergeRecoveryIntoSystem(messages: readonly ChatMessage[], recoverySuffix: string): ChatMessage[] {
  const firstSystemIdx = messages.findIndex((m) => m.role === "system");
  if (firstSystemIdx === -1) {
    return [{ role: "system", content: [{ type: "text", text: recoverySuffix }] }, ...messages];
  }
  const original = messages[firstSystemIdx];
  const originalText = original.content[0]?.type === "text" ? original.content[0].text : "";
  const merged: ChatMessage = {
    role: "system",
    content: [{ type: "text", text: `${originalText}\n\n${recoverySuffix}` }],
  };
  return [...messages.slice(0, firstSystemIdx), merged, ...messages.slice(firstSystemIdx + 1)];
}

function renderCurrentFiles(vfs: ReadonlyMap<string, string>, focusPath: string): string {
  const lines: string[] = ["CURRENT FILES (resolved so far this turn):"];
  let totalBudget = MAX_RECOVERY_TOTAL_BYTES;
  const ordered = orderForRecovery(vfs, focusPath);
  for (const [path, content] of ordered) {
    const cap = Math.min(MAX_RECOVERY_FILE_BYTES, totalBudget);
    if (cap <= 0) {
      lines.push(`--- ${path} (omitted: total context budget exhausted) ---`);
      continue;
    }
    if (content.length <= cap) {
      lines.push(`--- ${path} ---`, content);
      totalBudget -= content.length;
    } else {
      lines.push(
        `--- ${path} (truncated: ${content.length} bytes → first ${cap}) ---`,
        content.slice(0, cap),
        `--- ${path} (truncated above) ---`
      );
      totalBudget -= cap;
    }
  }
  return lines.join("\n");
}

function orderForRecovery(vfs: ReadonlyMap<string, string>, focusPath: string): [string, string][] {
  const entries = Array.from(vfs.entries());
  const focusEntry = entries.find(([p]) => p === focusPath || `/${p}` === focusPath || p === `/${focusPath}`);
  if (focusEntry === undefined) {
    return entries.sort((a, b) => a[0].localeCompare(b[0]));
  }
  const others = entries.filter((e) => e !== focusEntry).sort((a, b) => a[0].localeCompare(b[0]));
  return [focusEntry, ...others];
}

export interface RecoveryBudget {
  readonly maxConsecutiveFruitless: number;
}

export interface RecoveryCounter {
  readonly consecutiveFruitless: number;
}

// Update the counter after a recovery stream finishes. The recovery prompt
// is stateless for the LLM — as long as it's making progress on any
// recovery turn (at least one clean apply), the counter resets. Only
// stuck loops where the model returns a malformed response that applies
// zero edits will increment the counter and eventually exhaust the budget.
// The original (non-recovery) stream is never tracked through this helper.
export function updateRecoveryCounter(counter: RecoveryCounter, outcome: { readonly madeProgress: boolean }): RecoveryCounter {
  return outcome.madeProgress ? { consecutiveFruitless: 0 } : { consecutiveFruitless: counter.consecutiveFruitless + 1 };
}

// Decide whether to dispatch another recovery given the current counter.
// Default budget: 3 consecutive fruitless recoveries before giving up.
export function shouldAttemptRecovery(counter: RecoveryCounter, budget: RecoveryBudget = { maxConsecutiveFruitless: 3 }): boolean {
  return counter.consecutiveFruitless < budget.maxConsecutiveFruitless;
}
