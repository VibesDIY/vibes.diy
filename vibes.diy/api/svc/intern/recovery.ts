import { Result } from "@adviser/cement";
import {
  applyEdits,
  parseFenceBody,
  type ChatMessage,
  type CodeBeginMsg,
  type CodeLineMsg,
  type CodeEndMsg,
  type LLMRequest,
} from "@vibes.diy/call-ai-v2";

// Pure helpers for the apply-error recovery orchestrator. The wire-level
// orchestration (abort upstream + splice continuation events) lives in
// prompt-chat-section.ts; everything testable lives here.

export interface CodeBlock {
  readonly begin: CodeBeginMsg;
  readonly lines: readonly CodeLineMsg[];
  readonly end?: CodeEndMsg;
}

// Snapshot of a per-block apply step. `errors` is empty when the block
// applied cleanly. When non-empty, the caller can decide to abort + recover.
export interface PerBlockResolveStep {
  readonly path: string;
  readonly content: string;
  readonly errors: readonly { readonly reason: string; readonly search: string }[];
}

// Resolve a single just-finished code block against the running per-path
// vfs. The vfs is mutated in-place (set of path -> content). Returns the
// step record for caller diagnostics; the caller decides whether to abort.
//
// Mirrors the grouping logic in resolveCodeBlocksToFileSystem but runs once
// per block so the server can react mid-stream rather than at end-of-turn.
export function applyOneBlockToVfs(vfs: Map<string, string>, block: CodeBlock): PerBlockResolveStep {
  if (block.end === undefined) {
    return { path: block.begin.path ?? "App.jsx", content: "", errors: [] };
  }
  const path = block.begin.path ?? "App.jsx";
  const filename = path.startsWith("/") ? path : `/${path}`;
  const seed = vfs.get(filename) ?? vfs.get(path) ?? "";
  const parsed = parseFenceBody(block.lines.map((l) => l.line));
  const r = applyEdits(seed, parsed.edits);
  vfs.set(filename, r.content);
  return {
    path: filename,
    content: r.content,
    errors: r.errors.map((e) => ({ reason: e.reason, search: e.search })),
  };
}

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
// synthetic system message with CURRENT FILES (resolved-so-far) + FAILED
// (the search text + reason). The recovery-addendum is appended to any
// existing system message via concatenation in the caller's system-prompt
// path; here we just emit a `system` content block for the recovery hint.
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
  const filesBlock = renderCurrentFiles(vfs);
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

function renderCurrentFiles(vfs: ReadonlyMap<string, string>): string {
  const lines: string[] = ["CURRENT FILES (resolved so far this turn):"];
  // Stable order so the prompt doesn't churn between calls.
  const sorted = Array.from(vfs.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [path, content] of sorted) {
    lines.push(`--- ${path} ---`);
    lines.push(content);
  }
  return lines.join("\n");
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
  return [`FAILED EDIT (path: ${failedPath}, reason: ${failedReason}):`, "<<<<<<< SEARCH", failedSearch, ">>>>>>> SEARCH"].join(
    "\n"
  );
}

export interface RecoveryBudget {
  readonly maxAttempts: number;
}

export interface RecoveryCounter {
  readonly attempts: number;
}

// Decide whether an additional recovery attempt is allowed. Recovery #1 is
// allowed; #2+ exhausts. Returns the new counter; caller emits the
// `prompt.recovery.exhausted` event when `allowed` is false.
export function tryConsumeRecovery(
  counter: RecoveryCounter,
  budget: RecoveryBudget = { maxAttempts: 1 }
): { readonly allowed: boolean; readonly next: RecoveryCounter } {
  if (counter.attempts >= budget.maxAttempts) {
    return { allowed: false, next: counter };
  }
  return { allowed: true, next: { attempts: counter.attempts + 1 } };
}
