import { type } from "arktype";
import { CoercedDate } from "./types.js";
import { passthrough } from "./passthrough.js";
import { applyEdits, type Edit } from "./apply-edits.js";
import { parseFenceBody, type FenceParseError } from "./fence-body-parser.js";
import {
  type BlockStreamMsg,
  isBlockEnd,
  isCodeBegin,
  isCodeEnd,
  isCodeLine,
} from "./block-stream.js";

const FsBase = type({
  blockId: "string",
  streamId: "string",
  seq: "number",
  timestamp: CoercedDate,
});

export const FsApplyFailure = type({
  sectionIndex: "number",
  reason: "'no-match' | 'multiple-match' | 'parse-error'",
  "parseErrorKind?": "string",
  "matchCount?": "number",
  "search?": "string",
});
export type FsApplyFailure = typeof FsApplyFailure.infer;

export const FsFileSnapshotMsg = type({
  type: "'fs.file.snapshot'",
  path: "string",
  content: "string",
  sectionId: "string",
  source: "'create' | 'replace'",
  appliedSections: "number",
}).and(FsBase);
export type FsFileSnapshotMsg = typeof FsFileSnapshotMsg.infer;

export const FsApplyErrorMsg = type({
  type: "'fs.apply.error'",
  path: "string",
  sectionId: "string",
  failures: FsApplyFailure.array(),
}).and(FsBase);
export type FsApplyErrorMsg = typeof FsApplyErrorMsg.infer;

export const FsTurnEndMsg = type({
  type: "'fs.turn.end'",
  files: type({ "[string]": "string" }),
  errorCount: "number",
}).and(FsBase);
export type FsTurnEndMsg = typeof FsTurnEndMsg.infer;

export const FsStreamMsg = FsFileSnapshotMsg.or(FsApplyErrorMsg).or(FsTurnEndMsg);
export type FsStreamMsg = typeof FsStreamMsg.infer;

export const isFsFileSnapshot = (msg: unknown, streamId?: string): msg is FsFileSnapshotMsg =>
  !(FsFileSnapshotMsg(msg) instanceof type.errors) && (!streamId || (msg as FsFileSnapshotMsg).streamId === streamId);
export const isFsApplyError = (msg: unknown, streamId?: string): msg is FsApplyErrorMsg =>
  !(FsApplyErrorMsg(msg) instanceof type.errors) && (!streamId || (msg as FsApplyErrorMsg).streamId === streamId);
export const isFsTurnEnd = (msg: unknown, streamId?: string): msg is FsTurnEndMsg =>
  !(FsTurnEndMsg(msg) instanceof type.errors) && (!streamId || (msg as FsTurnEndMsg).streamId === streamId);

export interface FileSystemStreamOptions {
  readonly streamId: string;
  readonly createId: () => string;
  readonly seed?: ReadonlyMap<string, string>;
}

interface PendingBlock {
  readonly path: string;
  readonly lines: string[];
}

export function createFileSystemStream(
  opts: FileSystemStreamOptions
): TransformStream<BlockStreamMsg, BlockStreamMsg | FsStreamMsg> {
  const { streamId } = opts;
  const vfs = new Map<string, string>(opts.seed ?? []);
  const pending = new Map<string, PendingBlock>(); // sectionId → accumulator
  let seq = 0;

  return new TransformStream<BlockStreamMsg, BlockStreamMsg | FsStreamMsg>({
    transform: passthrough((msg, controller) => {
      if (isCodeBegin(msg, streamId)) {
        pending.set(msg.sectionId, {
          path: msg.path ?? "App.jsx",
          lines: [],
        });
        return;
      }

      if (isCodeLine(msg, streamId)) {
        const acc = pending.get(msg.sectionId);
        if (acc !== undefined) acc.lines.push(msg.line);
        return;
      }

      if (isCodeEnd(msg, streamId)) {
        const acc = pending.get(msg.sectionId);
        pending.delete(msg.sectionId);
        if (acc === undefined) return;

        const parsed = parseFenceBody(acc.lines);
        const seed = vfs.get(acc.path) ?? "";
        const result = applyEdits(seed, parsed.edits);

        const failures: FsApplyFailure[] = [];
        for (const pe of parsed.errors) {
          failures.push({ sectionIndex: -1, reason: "parse-error", parseErrorKind: pe.kind });
        }
        for (const ae of result.errors) {
          failures.push({
            sectionIndex: ae.index,
            reason: ae.reason,
            matchCount: ae.matchCount,
            search: ae.search,
          });
        }

        const isCreate = parsed.edits.some((e) => e.op === "create");
        const successfulSections = parsed.edits.length - result.errors.length;

        // Only commit to VFS if at least one edit succeeded or the block was a create.
        if (successfulSections > 0 || isCreate) {
          vfs.set(acc.path, result.content);
          controller.enqueue({
            type: "fs.file.snapshot",
            path: acc.path,
            content: result.content,
            sectionId: msg.sectionId,
            source: isCreate ? "create" : "replace",
            appliedSections: successfulSections,
            blockId: msg.blockId,
            streamId,
            seq: seq++,
            timestamp: new Date(),
          } satisfies FsFileSnapshotMsg);
        }

        if (failures.length > 0) {
          controller.enqueue({
            type: "fs.apply.error",
            path: acc.path,
            sectionId: msg.sectionId,
            failures,
            blockId: msg.blockId,
            streamId,
            seq: seq++,
            timestamp: new Date(),
          } satisfies FsApplyErrorMsg);
        }
        return;
      }

      if (isBlockEnd(msg, streamId)) {
        const filesObj: Record<string, string> = {};
        for (const [k, v] of vfs.entries()) filesObj[k] = v;
        controller.enqueue({
          type: "fs.turn.end",
          files: filesObj,
          errorCount: 0, // populated by downstream aggregator if needed
          blockId: msg.blockId,
          streamId,
          seq: seq++,
          timestamp: new Date(),
        } satisfies FsTurnEndMsg);
        return;
      }
    }),
  });
}

interface EditCount {
  readonly creates: number;
  readonly replaces: number;
}

export function classifyEdits(edits: readonly Edit[]): EditCount {
  let creates = 0;
  let replaces = 0;
  for (const e of edits) {
    if (e.op === "create") creates += 1;
    else replaces += 1;
  }
  return { creates, replaces };
}

// Helper for callers (chat reducer) that need to know whether all edits in a turn succeeded.
export function summarizeFailures(failures: readonly FsApplyFailure[]): readonly string[] {
  return failures.map((f) => {
    if (f.reason === "parse-error") return `parse error: ${f.parseErrorKind ?? "unknown"}`;
    const ctx = f.search !== undefined ? `: ${f.search.slice(0, 40)}…` : "";
    return `section #${f.sectionIndex + 1} ${f.reason}${ctx}`;
  });
}

// Re-export FenceParseError for consumers who want it.
export type { FenceParseError };
