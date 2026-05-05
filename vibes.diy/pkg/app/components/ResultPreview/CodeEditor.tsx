import { Editor } from "@monaco-editor/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { setupMonacoEditor } from "./setupMonacoEditor.js";
import { editor } from "monaco-editor";
import { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { useTheme } from "../../contexts/ThemeContext.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import { useParams } from "react-router";
import { applyEdits, applyReplace, isBlockEnd, isCodeBegin, isCodeEnd, isCodeLine, parseFenceBody } from "@vibes.diy/call-ai-v2";
import {
  AppCode,
  EditorState,
  EditorStateEdit,
  EditorStateToEdit,
  isEditorStateEdit,
  isEditorStateMoreLines,
  isEditorStateStartGenerating,
  isEditorStateToEdit,
} from "../../types/code-editor.js";
import type { Monaco } from "@monaco-editor/react";
import { toast } from "react-hot-toast";
import fnv1a from "@sindresorhus/fnv1a";

interface CodeEditorProps {
  // runState: SettleState;
  promptState: PromptState;
  onCode?: (event: EditorState) => void;
}

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
    if (debugSections.some((s) => s.applyErrors.length > 0 || s.parseErrors.length > 0)) {
      console.warn("[aider-edits] resolution had errors", dbg.__aiderEditsDebug);
    } else {
      console.log("[aider-edits] resolved", {
        fsId,
        seedLen: seedFromHydrate.length,
        sections: debugSections.length,
        matchKinds: debugSections.flatMap((s) => s.matchKinds),
        finalLen: source.length,
        snapshotFsIds: [...snapshotByFsId.keys()],
      });
    }
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

function updateCursorPosition(
  ref: React.RefObject<{
    editor: editor.IStandaloneCodeEditor;
    api: Monaco;
  } | null>,
  editorState:
    | Omit<EditorStateToEdit, "cursorPosition">
    | (Omit<EditorStateEdit, "toEdit"> & { toEdit: Omit<EditorStateToEdit, "cursorPosition"> })
): EditorState {
  let cursorPosition = { lineNumber: 1, column: 1 };
  if (ref.current) {
    cursorPosition = ref.current.editor.getPosition() ?? cursorPosition;
  }
  // console.log(`Updating editor state with cursor position:`, cursorPosition, `for editorState:`, editorState.state);
  if (isEditorStateToEdit(editorState, { onlyType: true })) {
    const model = ref.current?.editor.getModel();
    ref.current?.editor.setValue(editorState.buffer);
    if (model) {
      const validPosition = model.validatePosition({
        lineNumber: cursorPosition.lineNumber,
        column: cursorPosition.column,
      });
      // console.log(`Setting cursor position in Monaco editor...`, validPosition);
      ref.current?.editor.setPosition(validPosition);
      ref.current?.editor.focus();
    }
    return { ...editorState, cursorPosition };
  }
  if (isEditorStateEdit(editorState, { onlyType: true })) {
    // console.log(
    //   `Edit Updating editor state with cursor position:`,
    //   cursorPosition,
    //   `for editorState:`,
    //   editorState.toEdit.onChange
    // );
    ref.current?.editor.setPosition(cursorPosition);
    return { ...editorState, toEdit: { ...editorState.toEdit, cursorPosition } };
  }
  return editorState as EditorState;
}

export function CodeEditor({ promptState, onCode }: CodeEditorProps) {
  const { isDarkMode } = useTheme();
  const { fsId } = useParams<{ fsId?: string }>();

  // const editorChecker = useRef<ReturnType<typeof setInterval> | null>(null);

  const monacoReadyRef = useRef<{
    editor: editor.IStandaloneCodeEditor;
    api: Monaco;
  } | null>(null);
  const highlighterRef = useRef<HighlighterGeneric<BundledLanguage, BundledTheme> | null>(null);
  // const errorMarkersRef = useRef<editor.IMarker[]>([]);
  // const userScrolledRef = useRef<boolean>(false);
  // const disposablesRef = useRef<{ dispose: () => void }[]>([]);

  const appCodeGenerating = getCode(promptState, fsId);
  const prevAppCodeRef = useRef<AppCode>({
    code: [],
    complete: false,
    streamId: undefined,
  });

  const prevAppCode = prevAppCodeRef.current;

  // const [state, setState] = useState<EditorState>({ state: "idle" });
  const stateRef = useRef<EditorState>({ state: "idle" });
  // stateRef.current = state;

  function setState(newState: EditorState) {
    // console.log(`Setting new editor state:`, newState);
    stateRef.current = newState;
    onCode?.(newState);
  }

  const [monacoReady, setMonacoReady] = useState(false);

  useEffect(() => {
    if (!monacoReadyRef.current) {
      return;
    }
    if (appCodeGenerating.streamId !== prevAppCode.streamId) {
      const lines = [...appCodeGenerating.code];
      const buffer = lines.join("\n");
      if (appCodeGenerating.complete) {
        setState(
          updateCursorPosition(monacoReadyRef, {
            state: "to-edit",
            buffer,
            onChange: handleCodeChange,
            hash: fnv1a(buffer),
          })
        );
      } else {
        setState({ state: "start-generating", lines });
      }
      prevAppCodeRef.current = {
        code: lines,
        complete: appCodeGenerating.complete,
        streamId: appCodeGenerating.streamId,
      };
      return;
    }
    if (appCodeGenerating.code.length !== prevAppCode.code.length) {
      // console.log(`New code lines received:`, appCodeGenerating.code, prevAppCode.code);
      setState({
        state: "more-lines",
        lines: appCodeGenerating.code,
        newLines: appCodeGenerating.code.slice(prevAppCode.code.length),
      });
      prevAppCodeRef.current.code = [...appCodeGenerating.code];
    }
    if (appCodeGenerating.complete && !prevAppCode.complete) {
      const buffer = appCodeGenerating.code.join("\n");
      setState(
        updateCursorPosition(monacoReadyRef, {
          state: "to-edit",
          buffer,
          onChange: handleCodeChange,
          hash: fnv1a(buffer),
        })
      );
      monacoReadyRef.current.editor.setValue(buffer);
      prevAppCodeRef.current.complete = true;
      return;
    }
  }, [
    monacoReadyRef.current,
    prevAppCode.streamId,
    prevAppCode.code.length,
    prevAppCode.complete,
    appCodeGenerating.streamId,
    appCodeGenerating.code.length,
    appCodeGenerating.complete,
  ]);

  // useEffect(() => {
  //   onCode?.(state);
  // }, [state]);

  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      setupMonacoEditor(editor, monaco, {
        isDarkMode: isDarkMode,
        setHighlighter: (h) => {
          highlighterRef.current = h as HighlighterGeneric<BundledLanguage, BundledTheme>;
        },
      }).then(() => {
        // console.log("Monaco editor is ready");
        setMonacoReady(true);
        monacoReadyRef.current = { editor, api: monaco };
      });
    },
    [monacoReadyRef, isDarkMode]
  );

  const [newCode, setNewCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    const s = stateRef.current;
    const newHash = fnv1a(newCode ?? "");
    if (isEditorStateToEdit(s) && newHash !== s.hash) {
      // console.log(`toEdit-to-edit state -
      //     new code hash ${newHash}:${newCode?.length} differs from
      //     current state hash ${s.hash}:${s.buffer.length}`);
      setState(updateCursorPosition(monacoReadyRef, { state: "edit", toEdit: s, buffer: newCode ?? "", hash: newHash }));
    } else if (isEditorStateEdit(s)) {
      if (newHash === s.toEdit.hash) {
        setState(updateCursorPosition(monacoReadyRef, s.toEdit));
      } else if (newHash !== s.hash) {
        setState(updateCursorPosition(monacoReadyRef, { ...s, buffer: newCode ?? "", hash: newHash }));
      }
    }
  }, [newCode]);

  const handleCodeChange = useCallback((newCode?: string) => {
    setNewCode(newCode);
  }, []);

  // const scrollToBottomRef = useRef<{ lastScrollTime: Date; lastLine: number } | null>(null);
  const lastAppliedStateRef = useRef<EditorState | null>(null);

  useEffect(() => {
    if (!monacoReadyRef.current) return;
    if (lastAppliedStateRef.current === stateRef.current) return;
    lastAppliedStateRef.current = stateRef.current;

    const { editor, api } = monacoReadyRef.current;

    if (isEditorStateStartGenerating(stateRef.current)) {
      editor.setValue(stateRef.current.lines.join("\n"));
      editor.revealLineInCenter(stateRef.current.lines.length);
    } else if (isEditorStateMoreLines(stateRef.current)) {
      const model = editor.getModel();
      if (!model) {
        toast.error("Monaco editor model not found");
        return;
      }
      const endRange = model.getFullModelRange();
      const endPos = { lineNumber: endRange.endLineNumber, column: endRange.endColumn };
      const prefix = model.getValueLength() === 0 ? "" : "\n";
      model.applyEdits([
        {
          range: new api.Range(endPos.lineNumber, endPos.column, endPos.lineNumber, endPos.column),
          text: prefix + stateRef.current.newLines.join("\n"),
        },
      ]);
      editor.revealLineInCenter(model.getFullModelRange().endLineNumber);
    }
  }, [monacoReady, stateRef.current]);

  const onChange = isEditorStateToEdit(stateRef.current)
    ? stateRef.current.onChange
    : isEditorStateEdit(stateRef.current)
      ? stateRef.current.toEdit.onChange
      : undefined;
  // console.log("Rendering CodeEditor with state:", state, "and onChange:", onChange,
  // (ArkEditorStateEdit.or(ArkEditorStateToEdit)(state) as type.errors).summary)

  return (
    <div data-testid="sandpack-provider" className="h-full">
      <div
        style={{
          visibility: "visible",
          position: "static",
          height: "100%",
          width: "100%",
          top: 0,
          left: 0,
        }}
      >
        {/* <pre>
          {`State: ${state.state}, ${prevAppCode.streamId} 
          ${(state as { buffer?: string }).buffer?.length} vs 
          ${(state as { lines?: string[] }).lines?.length}`}
        </pre> */}
        <Editor
          height="100%"
          width="100%"
          path="/App.jsx"
          defaultLanguage="jsx"
          theme={isDarkMode ? "github-dark-default" : "github-light-default"}
          // value={editedCode().appCode.code}
          onChange={onChange}
          options={{
            readOnly: false,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            lineNumbers: "on",
            wordWrap: "on",
            padding: { top: 16 },
            formatOnType: true,
            formatOnPaste: true,
          }}
          onMount={handleEditorMount}
        />
      </div>
    </div>
  );
}

export default CodeEditor;
