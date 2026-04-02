import { Editor } from "@monaco-editor/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { setupMonacoEditor } from "./setupMonacoEditor.js";
import { editor } from "monaco-editor";
import { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { useTheme } from "../../contexts/ThemeContext.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import { useParams } from "react-router";
import { isBlockEnd, isCodeBegin, isCodeEnd, isCodeLine } from "@vibes.diy/call-ai-v2";
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

function getCode(promptState: PromptState, fsId?: string | null): AppCode {
  const retCode: string[] = [];
  let complete = false;
  let streamId: string | undefined;
  for (const block of [...promptState.blocks].reverse()) {
    if (fsId) {
      const blockEnd = block.msgs.find((msg) => isBlockEnd(msg));
      if (!blockEnd || !isBlockEnd(blockEnd) || blockEnd.fsRef?.fsId !== fsId) {
        continue;
      }
    }
    let foundCode = false;
    for (const msg of block.msgs) {
      switch (true) {
        case isCodeBegin(msg):
          retCode.splice(0, retCode.length);
          foundCode = true;
          complete = false;
          streamId = msg.streamId;
          break;
        case isCodeEnd(msg):
          complete = true;
          break;
        case isCodeLine(msg):
          retCode.push(msg.line);
          break;
      }
    }
    if (foundCode) {
      return { code: retCode, complete, streamId };
    }
  }
  return { code: retCode, complete, streamId };
}

// function whyDiffers(a: string, b: string): string {
//   if (a === b) return "equal";
//   if (a.length !== b.length) return `length differs: ${a.length} vs ${b.length}`;
//   for (let i = 0; i < a.length; i++) {
//     if (a[i] !== b[i]) {
//       return `first diff at [${i}]: '${a[i]}'(${a.charCodeAt(i)}) vs '${b[i]}'(${b.charCodeAt(i)}) — context: "${a.slice(Math.max(0, i - 10), i + 10)}" vs "${b.slice(Math.max(0, i - 10), i + 10)}"`;
//     }
//   }
//   return "unknown";
// }

// interface EditorMountRefs {
//   monacoEditorRef: React.RefObject<editor.IStandaloneCodeEditor | null>;
//   monacoApiRef: React.RefObject<Monaco | null>;
//   highlighterRef: React.RefObject<HighlighterGeneric<BundledLanguage, BundledTheme> | null>;
//   errorMarkersRef: React.RefObject<editor.IMarker[]>;
//   userScrolledRef: React.RefObject<boolean>;
//   disposablesRef: React.RefObject<{ dispose: () => void }[]>;
//   onMounted: () => void;
// }

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
  console.log(`Updating editor state with cursor position:`, cursorPosition, `for editorState:`, editorState.state);
  if (isEditorStateToEdit(editorState, { onlyType: true })) {
    const model = ref.current?.editor.getModel();
    ref.current?.editor.setValue(editorState.buffer);
    if (model) {
      const validPosition = model.validatePosition({
        lineNumber: cursorPosition.lineNumber,
        column: cursorPosition.column,
      });
      console.log(`Setting cursor position in Monaco editor...`, validPosition);
      ref.current?.editor.setPosition(validPosition);
      ref.current?.editor.focus();
    }
    return { ...editorState, cursorPosition };
  }
  if (isEditorStateEdit(editorState, { onlyType: true })) {
    console.log(
      `Edit Updating editor state with cursor position:`,
      cursorPosition,
      `for editorState:`,
      editorState.toEdit.onChange
    );
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
    console.log(`Setting new editor state:`, newState);
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
      console.log(`New code lines received:`, appCodeGenerating.code, prevAppCode.code);
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
        console.log("Monaco editor is ready");
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
      console.log(`toEdit-to-edit state - 
          new code hash ${newHash}:${newCode?.length} differs from 
          current state hash ${s.hash}:${s.buffer.length}`);
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
  useEffect(() => {
    // console.log(`Editor state changed:`, state, monacoReadyRef.current ? "editor ready" : "editor not ready");
    if (!monacoReadyRef.current) return;
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
      console.log(`Appending new code lines...`, stateRef.current.newLines, endPos);
      editor.revealLineInCenter(model.getFullModelRange().endLineNumber);
    }
    // if (isEditorStateToEdit(state)) {
    //   updateCursorPosition(monacoReadyRef, state);
    // }
  }, [monacoReady, stateRef.current]);

  // Reset manual scroll flag when streaming starts

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
