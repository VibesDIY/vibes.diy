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
import type { SectionEvent } from "@vibes.diy/api-types";

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
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (isFsFileSnapshot(value)) {
        opts.onSnapshot?.(value);
        continue;
      }
      if (isFsApplyError(value)) {
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
        continue;
      }
    }
    reader.releaseLock();
    return { files, errors };
  });
}
