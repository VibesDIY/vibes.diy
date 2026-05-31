import { applyEdits, applyReplace, isBlockEnd, isCodeBegin, isCodeEnd, isCodeLine, parseFenceBody } from "@vibes.diy/call-ai-v2";
import { AppCode } from "../../types/code-editor.js";
import { PromptState } from "../../routes/chat/chat.$ownerHandle.$appSlug.js";

interface DebugSection {
  blockIdx: number;
  fsRefId: string | undefined;
  rawLines: string[];
  parsedEdits: { kind: string; preview: string }[];
  parseErrors: { kind: string; lineNr: number }[];
  applyErrors: { index: number; reason: string; matchCount: number; searchPreview: string }[];
  matchKinds: string[];
  sourceLenBefore: number;
  sourceLenAfter: number;
}

export function getCode(promptState: PromptState, fsId?: string | null): AppCode {
  // Walk every block in chat order, applying each completed code section as
  // either a full-file `create` or one or more SEARCH/REPLACE edits against
  // the running source. Track per-fsId snapshots: when a block.end carries an
  // fsRef, capture the source state at that point as the snapshot for that
  // fsId.
  //
  // Lookup order:
  //   1. Snapshot for the requested fsId (if any block.end pinned that fsId).
  //   2. Hydrated saved file for the requested fsId (after chat reload).
  //   3. Latest running source (no historical match — typically the in-flight
  //      turn before block.end has fired).
  const seedFromHydrate = fsId && promptState.hydratedSource?.fsId === fsId ? promptState.hydratedSource.code.join("\n") : "";
  let source = seedFromHydrate;
  let complete = false;
  let streamId: string | undefined;
  let foundAny = false;
  const snapshotByFsId = new Map<string, string>();

  const debugSections: DebugSection[] = [];

  for (let blockIdx = 0; blockIdx < promptState.blocks.length; blockIdx += 1) {
    const block = promptState.blocks[blockIdx];
    let codeLines: string[] = [];
    let inSection = false;
    let sectionClosed = false;
    for (const msg of block.msgs) {
      if (isCodeBegin(msg)) {
        codeLines = [];
        inSection = true;
        sectionClosed = false;
        streamId = msg.streamId;
        foundAny = true;
        continue;
      }
      if (isCodeLine(msg) && inSection) {
        codeLines.push(msg.line);
        continue;
      }
      if (isCodeEnd(msg) && inSection) {
        const parsed = parseFenceBody(codeLines);
        const sourceLenBefore = source.length;
        const result = applyEdits(source, parsed.edits);
        const matchKinds: string[] = [];
        // Re-run per-edit so we can capture matchKind for telemetry.
        let probeSource = source;
        for (const edit of parsed.edits) {
          if (edit.op === "create") {
            matchKinds.push("create");
            probeSource = edit.content;
          } else {
            const r = applyReplace({ source: probeSource, search: edit.search, replace: edit.replace });
            matchKinds.push(r.ok ? r.matchKind : `error:${r.reason}`);
            if (r.ok) probeSource = r.content;
          }
        }
        source = result.content;
        inSection = false;
        sectionClosed = true;
        debugSections.push({
          blockIdx,
          fsRefId: undefined,
          rawLines: codeLines,
          parsedEdits: parsed.edits.map((e) =>
            e.op === "create"
              ? { kind: "create", preview: e.content.slice(0, 80) }
              : { kind: "replace", preview: e.search.slice(0, 80) }
          ),
          parseErrors: parsed.errors.map((e) => ({ kind: e.kind, lineNr: e.lineNr })),
          applyErrors: result.errors.map((e) => ({
            index: e.index,
            reason: e.reason,
            matchCount: e.matchCount,
            searchPreview: e.search.slice(0, 80),
          })),
          matchKinds,
          sourceLenBefore,
          sourceLenAfter: result.content.length,
        });
      }
    }
    // For an in-flight section (no code.end yet), preview a tentative create —
    // if the body has no SEARCH markers we can show the partial content.
    if (inSection) {
      const parsed = parseFenceBody(codeLines);
      const onlyCreate = parsed.edits.length === 1 && parsed.edits[0].op === "create";
      if (onlyCreate) {
        source = (parsed.edits[0] as { content: string }).content;
      }
    }
    complete = sectionClosed;

    // Snapshot the resolved source under this block's fsId (if pinned).
    const blockEnd = block.msgs.find((msg) => isBlockEnd(msg));
    if (blockEnd && isBlockEnd(blockEnd) && blockEnd.fsRef?.fsId) {
      snapshotByFsId.set(blockEnd.fsRef.fsId, source);
    }
  }

  // Expose debug snapshot for inspection from chrome devtools / tests.
  // PreviewApp reads `failedSectionCount` to surface a toast when new failed
  // fence blocks appear during streaming. We count distinct sections-with-
  // errors (rather than summing parseErrors + applyErrors) because a single
  // SEARCH/REPLACE failure can appear in both arrays — the parser flagging
  // its body and the edit then failing to apply — which would double-count.
  if (typeof window !== "undefined" && debugSections.length > 0) {
    const dbg = window as unknown as {
      __aiderEditsDebug?: {
        fsId: string | null | undefined;
        seedLen: number;
        sections: DebugSection[];
        finalLen: number;
        snapshotFsIds: string[];
        failedSectionCount: number;
      };
    };
    const failedSectionCount = debugSections.reduce(
      (acc, s) => acc + (s.applyErrors.length > 0 || s.parseErrors.length > 0 ? 1 : 0),
      0
    );
    dbg.__aiderEditsDebug = {
      fsId,
      seedLen: seedFromHydrate.length,
      sections: debugSections,
      finalLen: source.length,
      snapshotFsIds: [...snapshotByFsId.keys()],
      failedSectionCount,
    };
  }

  if (fsId) {
    const snap = snapshotByFsId.get(fsId);
    if (snap !== undefined) {
      return { code: snap.split("\n"), complete: true, streamId };
    }
    if (promptState.hydratedSource?.fsId === fsId) {
      return { code: promptState.hydratedSource.code, complete: true, streamId: `hydrate-${fsId}` };
    }
  }
  if (foundAny) {
    return { code: source.split("\n"), complete, streamId };
  }
  return { code: [], complete, streamId };
}
