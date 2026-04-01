import { Editor } from "@monaco-editor/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { setupMonacoEditor } from "./setupMonacoEditor.js";
import { editor } from "monaco-editor";
import { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { useTheme } from "../../contexts/ThemeContext.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import { useParams } from "react-router";
import { isBlockEnd, isCodeBegin, isCodeEnd, isCodeLine } from "@vibes.diy/call-ai-v2";
import { AppCode, EditorState, isEditorStateEdit, isEditorStateToEdit } from "../../types/code-editor.js";
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

export function CodeEditor({ promptState }: CodeEditorProps) {
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

  const [state, setState] = useState<EditorState>({ state: "idle" });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (appCodeGenerating.streamId !== prevAppCode.streamId) {
      const lines = [...appCodeGenerating.code];
      if (appCodeGenerating.complete) {
        setState({ state: "to-edit", buffer: lines.join("\n"), onChange: handleCodeChange, hash: fnv1a(lines.join("\n")) });
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
      setState({
        state: "more-lines",
        lines: appCodeGenerating.code,
        newLines: appCodeGenerating.code.slice(prevAppCode.code.length),
      });
      prevAppCodeRef.current.code = [...appCodeGenerating.code];
    }
    if (appCodeGenerating.complete && !prevAppCode.complete) {
      setState({
        state: "to-edit",
        buffer: appCodeGenerating.code.join("\n"),
        onChange: handleCodeChange,
        hash: fnv1a(appCodeGenerating.code.join("\n")),
      });
      prevAppCodeRef.current.complete = true;
      return;
    }
  }, [
    prevAppCode.streamId,
    prevAppCode.code.length,
    prevAppCode.complete,
    appCodeGenerating.streamId,
    appCodeGenerating.code.length,
    appCodeGenerating.complete,
  ]);

  const [monacoReady, setMonacoReady] = useState(false);

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

  // const editedCodeRef = useRef<CodeEvent>({
  //   type: "onCode",
  //   codeState: "init",
  //   appCode: appCodeGenerating,
  // });

  // function onCodeChange(event: CodeEvent) {
  //   // console.log(`onCodeChange`, event);
  //   editedCodeRef.current = event;
  //   onCode?.(event);
  // }

  // function editedCode(): CodeEvent {
  //   return editedCodeRef.current;
  // }

  const handleCodeChange = useCallback((newCode?: string) => {
    const s = stateRef.current;
    const newHash = fnv1a(newCode ?? "");
    console.log(`handleCodeChange: newHash ${newHash}, prevHash ${s.state}`);
    if (isEditorStateToEdit(s) && newHash !== s.hash) {
      setState({ state: "edit", toEdit: s, buffer: newCode ?? "", hash: newHash });
    } else if (isEditorStateEdit(s)) {
      if (newHash === s.toEdit.hash) {
        setState(s.toEdit);
      } else if (newHash !== s.hash) {
        setState({ ...s, buffer: newCode ?? "", hash: newHash });
      }
    }
  }, []);

  // useEffect(() => {
  //   if (promptState.running) {
  //     userScrolledRef.current = false;
  //   }
  // }, [promptState.running]);

  // useEffect(() => {
  //   return () => {
  //     console.log("Disposing editor resources");
  //     // if (editorChecker.current) {
  //     //   clearInterval(editorChecker.current);
  //     // }
  //     // monacoReadyRef.current?.editor.dispose();
  //     // highlighterRef.current?.dispose();
  //     // disposablesRef.current.forEach((d) => d.dispose());
  //     // disposablesRef.current = [];
  //   };
  // }, []);

  /*
  const [updateRef, setUpdateRef] = useState(false);

  useEffect(() => {
    console.log(
      `Checking for code changes...`,
      appCodeGenerating.complete,
      appCodeGenerating.code.length,
      prevAppCode.code.length,
      editedCode().appCode.code.length,
      editedCode().appCode.complete,
      editedCode().codeState
    );
    // if (isCodeEventInit(editedCode()) && appCode.complete && editedCode().appCode.complete) return;
    // if (appCode.code === editedCode().appCode.code) return; // prevent emitting if code is the same to avoid infinite loops with Monaco markers updates
    onCodeChange({
      type: "onCode",
      codeState: "ok",
      hasChanged: isCodeEventInit(editedCode()) || appCodeGenerating.code !== editedCode().appCode.code,
      appCode: appCodeGenerating,
    });
    setUpdateRef(true);
  }, [appCodeGenerating.streamId, appCodeGenerating.code.length, appCodeGenerating.complete, updateRef]);

  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      // ignore changes until initial code is fully loaded to prevent emitting onCode events with incomplete code
      if (!editedCode().appCode.complete) {
        return;
      }
      if (newCode === undefined) return;
      if (newCode === editedCode().appCode.code.join("\n")) return; // prevent emitting if code is the same to avoid infinite loops with Monaco markers updates
      // console.log(`handleCodeChange: code changed, emitting onCode event...`, {
      //   newCodeLength: newCode.length,
      //   oldCodeLength: editedCode().appCode.code.length,
      //   why: whyDiffers(newCode, editedCode().appCode.code),
      // });
      onCodeChange({
        type: "onCode",
        codeState: "edit",
        appCode: {
          complete: true,
          code: newCode.split("\n"),
        },
      });
    },
    [editedCode()]
  );

  useEffect(() => {
    if (!onCode) return;
    if (!monacoReadyRef.current) return;
    if (editorChecker.current) return;

    const monaco = monacoReadyRef.current;
    const defaults = monaco.api.typescript.javascriptDefaults;
    if (editedCode().appCode.complete) {
      console.log(`Setting initial code value in Monaco editor...`, appCodeGenerating.code.length);
      const model = monaco.editor.getModel();
      if (!model) {
        return;
      }
      console.log(`Setting initial code value in Monaco editor...`, appCodeGenerating.code.length);
      model.setValue(appCodeGenerating.code.join("\n"));

      // if generating code, disable diagnostics to prevent noise from incomplete code
      defaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: true,
      });
      return;
    }
    // const current = typeof defaults.getDiagnosticsOptions === "function" ? defaults.getDiagnosticsOptions() : undefined;
    defaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    function refreshState() {
      const model = monaco.editor.getModel();
      if (!model) return;
      const val = monaco.editor.getValue();
      if (!val) return;
      const errorMarkers = MonacoMarkerInfo.onDeepUndeclaredKey("delete").array()(
        monaco.api.editor
          .getModelMarkers({ resource: model.uri })
          .filter((m: editor.IMarker) => m.severity === MarkerSeverity.Error)
      );

      if (errorMarkers instanceof type.errors) {
        console.error("Error validating Monaco markers:", errorMarkers);
        return;
      }
      const edited = editedCode();
      // console.log(`Checking code changes and markers...`, edited.codeState, errorMarkers.length);
      if ((isCodeEventOk(edited) || isCodeEventEdit(edited)) && errorMarkers.length == 0 && val === edited.appCode.code.join("\n"))
        return; // only check for marker changes if code is the same to avoid infinite loops with Monaco markers updates
      if (isCodeEventError(edited) && errorMarkers.length > 0 && JSON.stringify(errorMarkers) === JSON.stringify(edited.markers)) {
        return; // prevent emitting if markers are the same to avoid infinite loops with Monaco markers updates
      }
      // console.log(`Code or markers changed, emitting onCode event...`,
      //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
      //   errorMarkers, (edited as any).markers)
      // // console.log(`Checking code changes and markers...`, whyDiffers(val, edited.appCode.code));

      // console.log("xxxx-2");
      if (errorMarkers.length > 0) {
        onCodeChange({
          type: "onCode",
          codeState: "error",
          markers: errorMarkers,
          // .map((m) => ({
          //   message: m.message,
          //   startLineNumber: m.startLineNumber,
          //   startColumn: m.startColumn,
          //   endLineNumber: m.endLineNumber,
          //   endColumn: m.endColumn,
          //   severity: m.severity,
          // })),
          appCode: {
            complete: true,
            code: val.split("\n"),
          },
        });
      } else if (val.split("\n") !== edited.appCode.code || errorMarkers.length === 0) {
        // console.log(`Code is valid, emitting onCode event...`, val.length);
        onCodeChange({
          type: "onCode",
          codeState: edited.codeState === "init" ? "ok" : "edit",
          hasChanged: true,
          appCode: {
            complete: true,
            code: val.split("\n"),
          },
        });
      }
    }
    editorChecker.current = setInterval(refreshState, 500);
    // refreshState();
  }, [onCode, editedCode, monacoReadyRef, editorChecker]);

  */
  // const scrollToBottomRef = useRef<{ lastScrollTime: Date; lastLine: number } | null>(null);
  useEffect(() => {
    console.log(`Editor state changed:`, state, monacoReadyRef.current ? "editor ready" : "editor not ready");
    if (!monacoReadyRef.current) return;
    const { editor, api } = monacoReadyRef.current;

    if (state.state === "start-generating") {
      editor.setValue(state.lines.join("\n"));
      editor.revealLineInCenter(state.lines.length);
    } else if (state.state === "more-lines") {
      const model = editor.getModel();
      if (!model) {
        toast.error("Monaco editor model not found");
        return;
      }
      console.log(`Appending new code lines...`, state.newLines);
      const lastLine = model.getLineCount();
      const lastCol = model.getLineMaxColumn(lastLine);
      let prefix = "\n";
      if (state.lines.length === 0) {
        prefix = "";
      }
      model.applyEdits([
        {
          range: new api.Range(lastLine, lastCol, lastLine, lastCol),
          text: prefix + state.newLines.join("\n"),
        },
      ]);
      editor.revealLineInCenter(state.lines.length);
    }
    if (state.state === "to-edit") {
      editor.setValue(state.buffer);
      console.log(`SetValue:`, state.buffer.length);
      editor.revealLineInCenter(1);
    }
  }, [monacoReady, state.state]);

  // Reset manual scroll flag when streaming starts

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
        <pre>
          {`State: ${state.state}, ${prevAppCode.streamId} 
          ${(state as { buffer?: string }).buffer?.length} vs 
          ${(state as { lines?: string[] }).lines?.length}`}
        </pre>
        <Editor
          height="100%"
          width="100%"
          path="/App.jsx"
          defaultLanguage="jsx"
          theme={isDarkMode ? "github-dark-default" : "github-light-default"}
          // value={editedCode().appCode.code}
          onChange={isEditorStateToEdit(state) ? state.onChange : isEditorStateEdit(state) ? state.toEdit.onChange : undefined}
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
