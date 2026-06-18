import { Result, exception2Result } from "@adviser/cement";
import {
  createFileSystemStream,
  isFsApplyError,
  isFsFileSnapshot,
  isFsTurnEnd,
  summarizeFailures,
  type BlockStreamMsg,
  type FsApplyErrorMsg,
  type FsFileSnapshotMsg,
} from "@vibes.diy/call-ai-v2";
import { isPromptBlockEnd, isPromptError } from "@vibes.diy/api-types";
import type { PromptError, SectionEvent } from "@vibes.diy/api-types";

export interface ResolveSectionStreamOpts {
  readonly sectionStream: ReadableStream<SectionEvent>;
  readonly streamId: string;
  readonly seed?: ReadonlyMap<string, string>;
  readonly onSnapshot?: (snap: FsFileSnapshotMsg) => void;
  readonly onError?: (err: FsApplyErrorMsg) => void;
}

export interface ResolveSectionStreamResult {
  readonly files: Readonly<Record<string, string>>;
  readonly errors: readonly string[];
  /** Count of `fs.file.snapshot` events the new turn produced — i.e. blocks
   *  whose SEARCH/REPLACE (or create) actually applied at least one section.
   *  Zero with `turnEndSeen=true` means the model returned but didn't change
   *  any file (silent no-op when `edit` seeds from disk: see issue #1626
   *  follow-up). */
  readonly snapshotCount: number;
  /** Count of `fs.apply.error` events for the new turn. */
  readonly applyErrorCount: number;
  /** Whether at least one `fs.turn.end` fired for the new turn. */
  readonly turnEndSeen: boolean;
  /** Human-readable `prompt.error` messages the server emitted for THIS
   *  streamId. Populated when the codegen turn ended abnormally — the server
   *  wraps the LLM action in an `onCatch` that emits `prompt.error` and a
   *  `finally` that always emits `prompt.block-end`, so an upstream
   *  disconnect/provider error never produces a `block.end` → `fs.turn.end`
   *  (see issue #2048 / #2334). The CLI surfaces these so an abnormal end
   *  reports *why* instead of looking like an empty response. */
  readonly promptErrors: readonly string[];
}

/**
 * Pipe a SectionEvent stream through `createFileSystemStream` and collect the
 * resolved file map. Used by the CLI's `generate` command so it consumes the
 * same shared streaming infrastructure as the UI reducer and the server-side
 * resolver — Aider-style SEARCH/REPLACE edits compose correctly across blocks
 * instead of being written verbatim to disk.
 *
 * The flatten step unwraps `event.blocks` (each SectionEvent carries an array
 * of block messages); `createFileSystemStream` filters them via its own type
 * guards, so non-block messages flow through harmlessly.
 *
 * Returns a `Result` with the final `Map<path, content>` from `fs.turn.end`
 * plus any human-readable apply/parse error summaries.
 */
export function resolveSectionStream(opts: ResolveSectionStreamOpts): Promise<Result<ResolveSectionStreamResult>> {
  const flatten = new TransformStream<SectionEvent, BlockStreamMsg>({
    transform(event, controller) {
      for (const msg of event.blocks) controller.enqueue(msg as BlockStreamMsg);
    },
  });

  const fsStream = createFileSystemStream({
    streamId: opts.streamId,
    createId: () => crypto.randomUUID(),
    seed: opts.seed,
  });

  return exception2Result(async () => {
    const reader = opts.sectionStream.pipeThrough(flatten).pipeThrough(fsStream).getReader();
    let files: Readonly<Record<string, string>> = {};
    const errors: string[] = [];
    const promptErrors: string[] = [];
    // Running latest-snapshot-per-path, seeded with any on-disk seed. Used as a
    // fallback when no `fs.turn.end` fires (abnormal stream end): each snapshot
    // carries the fully-resolved content for its path after a completed code
    // block, so the latest per path is the best-effort final filesystem.
    // Recovers files that would otherwise be discarded when the codegen turn
    // disconnects after the code streamed but before clean completion (#2048).
    const recovered: Record<string, string> = {};
    if (opts.seed) for (const [k, v] of opts.seed) recovered[k] = v;
    let snapshotCount = 0;
    let applyErrorCount = 0;
    let turnEndSeen = false;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (isFsFileSnapshot(value)) {
        snapshotCount += 1;
        recovered[value.path] = value.content;
        opts.onSnapshot?.(value);
        continue;
      }
      if (isFsApplyError(value)) {
        applyErrorCount += 1;
        opts.onError?.(value);
        for (const line of summarizeFailures(value.failures)) {
          errors.push(`${value.path}: ${line}`);
        }
        continue;
      }
      if (isFsTurnEnd(value)) {
        // fs.turn.end fires per block.end, each carrying the running vfs.
        // Keep overwriting — the last one is the fully-resolved turn.
        files = value.files;
        turnEndSeen = true;
        continue;
      }
      // Capture the server's abnormal-end signal for THIS streamId. Filtered by
      // streamId for the same reason the break below is (#1682): historical
      // replay on `edit` carries the prior turn's prompt.error too.
      if (isPromptError(value) && (value as PromptError).streamId === opts.streamId) {
        promptErrors.push((value as PromptError).error);
        continue;
      }
      // The source (chat.sectionStream) does not close at end-of-turn — it
      // stays open until chat.close() is called. Break on prompt.block-end
      // for THIS streamId — the LLM-turn-complete signal for the current
      // turn. Filtering by streamId is essential when the server replays
      // historical sections via resendChatSectionsPrevMsg on openChat (e.g.
      // CLI `edit` against an existing chat): without it, the loop exits on
      // the historical turn's terminator before the new response arrives
      // (issue #1682).
      if (isPromptBlockEnd(value, opts.streamId)) {
        break;
      }
    }
    reader.releaseLock();
    // Authoritative source is `fs.turn.end`. If it never fired (abnormal end),
    // fall back to the recovered snapshot map so already-resolved files aren't
    // thrown away — the difference between "no files" and a deployable app
    // when a gpt-5-style turn disconnects late (#2048).
    return {
      files: turnEndSeen ? files : recovered,
      errors,
      snapshotCount,
      applyErrorCount,
      turnEndSeen,
      promptErrors,
    };
  });
}
