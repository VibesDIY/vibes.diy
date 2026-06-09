import { applyEdits, applyReplace, isBlockEnd, isCodeBegin, isCodeEnd, isCodeLine, parseFenceBody } from "@vibes.diy/call-ai-v2";
import { AppCode } from "../../types/code-editor.js";
import { PromptState } from "../../routes/chat/chat.$ownerHandle.$appSlug.js";

// Files the AI may emit alongside `App.jsx` that are NOT part of the rendered
// preview. `access.js` is a server-side access function — it never runs in the
// sandbox iframe — so its edits must be routed to a separate buffer and never
// resolved as the preview source.
const DEFAULT_PATH = "App.jsx";
const SERVER_ONLY_PATHS = new Set(["access.js"]);

// Seeded/hydrated filesystem blocks carry leading-slash filenames (`/App.jsx`,
// `/access.js`) while fresh model edits stream bare (`App.jsx`). Strip any
// leading `./` or `/` so both forms key the same per-file buffer and the
// server-only check matches either form.
function normalizePath(path: string): string {
  return path.replace(/^(?:\.?\/)+/, "") || DEFAULT_PATH;
}

interface DebugSection {
  blockIdx: number;
  path: string;
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
  // The AI emits multiple files in one turn (e.g. `App.jsx` + `access.js`, or
  // `App.jsx` + `Counter.jsx` + `styles.css`). Each code section names its file
  // via `path`. Keep a separate running buffer per file so a companion-file
  // create can't clobber the `App.jsx` buffer (which would make every
  // subsequent App.jsx SEARCH/REPLACE fail to match). The preview resolves to
  // the render root — `App.jsx` by convention; companion files (components,
  // CSS, the server-side `access.js`) are imported by it, never rendered
  // standalone. Only if `App.jsx` never appears do we fall back to the first
  // client file seen.
  const seedFromHydrate = fsId && promptState.hydratedSource?.fsId === fsId ? promptState.hydratedSource.code.join("\n") : "";
  const sources = new Map<string, string>();
  if (seedFromHydrate) sources.set(DEFAULT_PATH, seedFromHydrate);
  let entryPath = DEFAULT_PATH;
  let appEntrySeen = Boolean(seedFromHydrate);
  // Track the render root: lock to `App.jsx` once it appears; until then, fall
  // back to the first non-server-only file written.
  const noteEntryPath = (path: string) => {
    if (SERVER_ONLY_PATHS.has(path)) return;
    if (path === DEFAULT_PATH) {
      appEntrySeen = true;
      entryPath = DEFAULT_PATH;
    } else if (!appEntrySeen) {
      entryPath = path;
    }
  };
  const entrySource = () => sources.get(entryPath) ?? "";
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
    let currentPath = DEFAULT_PATH;
    for (const msg of block.msgs) {
      if (isCodeBegin(msg)) {
        codeLines = [];
        inSection = true;
        sectionClosed = false;
        currentPath = normalizePath(msg.path ?? DEFAULT_PATH);
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
        const before = sources.get(currentPath) ?? "";
        const sourceLenBefore = before.length;
        const result = applyEdits(before, parsed.edits);
        const matchKinds: string[] = [];
        // Re-run per-edit so we can capture matchKind for telemetry.
        let probeSource = before;
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
        sources.set(currentPath, result.content);
        noteEntryPath(currentPath);
        inSection = false;
        sectionClosed = true;
        debugSections.push({
          blockIdx,
          path: currentPath,
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
    // if the body has no SEARCH markers we can show the partial content. Route
    // it to the section's own file so an in-flight access.js doesn't surface as
    // the App.jsx preview.
    if (inSection) {
      const parsed = parseFenceBody(codeLines);
      const onlyCreate = parsed.edits.length === 1 && parsed.edits[0].op === "create";
      if (onlyCreate) {
        sources.set(currentPath, (parsed.edits[0] as { content: string }).content);
        noteEntryPath(currentPath);
      }
    }
    complete = sectionClosed;

    // Snapshot the resolved entry source under this block's fsId (if pinned).
    const blockEnd = block.msgs.find((msg) => isBlockEnd(msg));
    if (blockEnd && isBlockEnd(blockEnd) && blockEnd.fsRef?.fsId) {
      snapshotByFsId.set(blockEnd.fsRef.fsId, entrySource());
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
      finalLen: entrySource().length,
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
    return { code: entrySource().split("\n"), complete, streamId };
  }
  return { code: [], complete, streamId };
}
