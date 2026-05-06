import { Result } from "@adviser/cement";
import { type ChatMessage, type LLMRequest } from "@vibes.diy/call-ai-v2";

// Pure helpers for the apply-error recovery orchestrator. The wire-level
// orchestration (abort upstream + splice continuation events) lives in
// prompt-chat-section.ts; everything testable lives here.
//
// Per-block apply lives in `createStreamingResolver` (in
// `prompt-chat-section.ts`). The orchestrator consumes its return value;
// nothing in this file re-runs parseFenceBody or applyEdits.

// Maximum bytes of file content we splice into the recovery prompt. Recovery
// happens after an apply error mid-turn; the original user prompt + system
// prompt is already heavy. Larger files are truncated with a marker so the
// model knows it's seeing a partial view. The failed file is rendered first
// and gets the full byte budget; other files come after and may be elided.
const MAX_RECOVERY_FILE_BYTES = 16_000;
const MAX_RECOVERY_TOTAL_BYTES = 32_000;

export interface RecoveryRequestInput {
  readonly originalRequest: LLMRequest;
  readonly recoveryAddendum: string;
  readonly vfs: ReadonlyMap<string, string>;
  readonly failedPath: string;
  readonly failedSearch: string;
  readonly failedReason: string;
}

// Compose the continuation LLM request. The original request's messages
// are preserved (so the user message remains canonical); we append a
// synthetic system message containing the recovery addendum, CURRENT FILES
// (resolved-so-far, size-bounded), and FAILED (the failed search text +
// reason). The model is instructed via the addendum to continue from the
// shown state and not retry the failed search verbatim.
export function buildRecoveryRequest({
  originalRequest,
  recoveryAddendum,
  vfs,
  failedPath,
  failedSearch,
  failedReason,
}: RecoveryRequestInput): Result<LLMRequest> {
  if (recoveryAddendum.length === 0) {
    return Result.Err("recovery addendum is empty");
  }
  if (failedPath.length === 0) {
    return Result.Err("failed path is empty");
  }
  const filesBlock = renderCurrentFiles(vfs, failedPath);
  const failedBlock = renderFailedSection({ failedPath, failedSearch, failedReason });
  const recoverySystemMessage: ChatMessage = {
    role: "system",
    content: [
      {
        type: "text",
        text: `${recoveryAddendum}\n\n${filesBlock}\n\n${failedBlock}`,
      },
    ],
  };
  return Result.Ok({
    ...originalRequest,
    messages: [...originalRequest.messages, recoverySystemMessage],
  });
}

function renderCurrentFiles(vfs: ReadonlyMap<string, string>, failedPath: string): string {
  const lines: string[] = ["CURRENT FILES (resolved so far this turn):"];
  // Failed file rendered first with its own per-file byte budget so the model
  // gets the most relevant context. Remaining files come after and share a
  // single total budget; oversize ones get truncated with an explicit marker.
  let totalBudget = MAX_RECOVERY_TOTAL_BYTES;
  const ordered = orderForRecovery(vfs, failedPath);
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

function orderForRecovery(vfs: ReadonlyMap<string, string>, failedPath: string): [string, string][] {
  const entries = Array.from(vfs.entries());
  // Match by exact, leading-slash, or trailing-slash variants so the caller
  // can pass the path in any normalization.
  const failedEntry = entries.find(([p]) => p === failedPath || `/${p}` === failedPath || p === `/${failedPath}`);
  if (failedEntry === undefined) {
    return entries.sort((a, b) => a[0].localeCompare(b[0]));
  }
  const others = entries.filter((e) => e !== failedEntry).sort((a, b) => a[0].localeCompare(b[0]));
  return [failedEntry, ...others];
}

function renderFailedSection({
  failedPath,
  failedSearch,
  failedReason,
}: {
  readonly failedPath: string;
  readonly failedSearch: string;
  readonly failedReason: string;
}): string {
  // Use a non-fence delimiter so the model isn't tempted to mirror the
  // SEARCH/REPLACE marker syntax in this descriptive context. Fence markers
  // are reserved for the model's actual edit output.
  return [
    `FAILED EDIT (path: ${failedPath}, reason: ${failedReason}):`,
    "--- failed search text ---",
    failedSearch,
    "--- end failed search text ---",
  ].join("\n");
}

export interface RecoveryBudget {
  readonly maxAttempts: number;
}

export interface RecoveryCounter {
  readonly attempts: number;
}

// Decide whether an additional recovery attempt is allowed. Recovery #1 is
// allowed; #2+ exhausts. Returns the new counter; caller emits the
// recovery-exhausted log event when `allowed` is false.
export function tryConsumeRecovery(
  counter: RecoveryCounter,
  budget: RecoveryBudget = { maxAttempts: 1 }
): { readonly allowed: boolean; readonly next: RecoveryCounter } {
  if (counter.attempts >= budget.maxAttempts) {
    return { allowed: false, next: counter };
  }
  return { allowed: true, next: { attempts: counter.attempts + 1 } };
}
