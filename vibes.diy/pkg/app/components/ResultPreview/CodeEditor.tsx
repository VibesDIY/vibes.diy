import { Editor } from "@monaco-editor/react";
import React, { useCallback, useEffect, useRef } from "react";
import { setupMonacoEditor } from "./setupMonacoEditor.js";
import { editor } from "monaco-editor";
import { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { useTheme } from "../../contexts/ThemeContext.js";
import { PromptState } from "../../routes/chat/chat.$userSlug.$appSlug.js";
import { useParams } from "react-router";
import { isBlockEnd, isCodeBegin, isCodeEnd, isCodeLine } from "@vibes.diy/call-ai-v2";
import { type } from "arktype";
import * as MonacoEditor from "monaco-editor";
import {
  CodeEvent,
  AppCode,
  isCodeEventEdit,
  isCodeEventError,
  isCodeEventInit,
  isCodeEventOk,
  MonacoMarkerInfo,
} from "../../types/code-editor.js";

type Monaco = typeof MonacoEditor;

interface CodeEditorProps {
  // runState: SettleState;
  promptState: PromptState;
  onCode?: (event: CodeEvent) => void;
}

function getCode(promptState: PromptState, fsId?: string | null): AppCode {
  const retCode: string[] = [];
  let complete = false;
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
      return { code: retCode.join("\n"), complete };
    }
  }
  return { code: retCode.join("\n"), complete };
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

export function CodeEditor({ promptState, onCode }: CodeEditorProps) {
  const { isDarkMode } = useTheme();
  const { fsId } = useParams<{ fsId?: string }>();

  const editorChecker = useRef<ReturnType<typeof setInterval> | null>(null);

  const monacoReadyRef = useRef<{
    editor: editor.IStandaloneCodeEditor;
    api: Monaco;
  } | null>(null);
  const highlighterRef = useRef<HighlighterGeneric<BundledLanguage, BundledTheme> | null>(null);
  // const errorMarkersRef = useRef<editor.IMarker[]>([]);
  // const userScrolledRef = useRef<boolean>(false);
  const disposablesRef = useRef<{ dispose: () => void }[]>([]);

  const appCode = getCode(promptState, fsId);

  const editedCodeRef = useRef<CodeEvent>({
    type: "onCode",
    codeState: "init",
    appCode,
  });

  function onCodeChange(event: CodeEvent) {
    // console.log(`onCodeChange`, event);
    editedCodeRef.current = event;
    onCode?.(event);
  }

  function editedCode(): CodeEvent {
    return editedCodeRef.current;
  }

  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      setupMonacoEditor(editor, monaco, {
        promptProcessing: !editedCode().appCode.complete,
        codeReady: editedCode().appCode.complete,
        isDarkMode: isDarkMode,
        // userScrolledRef: userScrolledRef,
        disposablesRef: disposablesRef,
        setHighlighter: (h) => {
          highlighterRef.current = h as HighlighterGeneric<BundledLanguage, BundledTheme>;
        },
      }).then(() => {
        monacoReadyRef.current = { editor, api: monaco };
      });
    },
    [monacoReadyRef, editedCode(), isDarkMode]
  );

  // useEffect(() => {
  //   if (promptState.running) {
  //     userScrolledRef.current = false;
  //   }
  // }, [promptState.running]);

  useEffect(() => {
    return () => {
      console.log("Disposing editor resources");
      // if (editorChecker.current) {
      //   clearInterval(editorChecker.current);
      // }
      // monacoReadyRef.current?.editor.dispose();
      // highlighterRef.current?.dispose();
      // disposablesRef.current.forEach((d) => d.dispose());
      // disposablesRef.current = [];
    };
  }, []);

  useEffect(() => {
    console.log(`Checking for code changes...`, appCode.complete, editedCode().appCode.complete);
    if (isCodeEventInit(editedCode()) && appCode.complete && editedCode().appCode.complete) return;
    // if (appCode.code === editedCode().appCode.code) return; // prevent emitting if code is the same to avoid infinite loops with Monaco markers updates
    onCodeChange({
      type: "onCode",
      codeState: "ok",
      hasChanged: isCodeEventInit(editedCode()) || appCode.code !== editedCode().appCode.code,
      appCode: appCode,
    });
  }, [appCode, editedCode()]);

  const handleCodeChange = useCallback(
    (newCode: string | undefined) => {
      // ignore changes until initial code is fully loaded to prevent emitting onCode events with incomplete code
      if (!editedCode().appCode.complete) {
        return;
      }
      if (newCode === undefined) return;
      if (newCode === editedCode().appCode.code) return; // prevent emitting if code is the same to avoid infinite loops with Monaco markers updates
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
          code: newCode,
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
    if (!editedCode().appCode.complete) {
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
          .filter((m: editor.IMarker) => m.severity === MonacoEditor.MarkerSeverity.Error)
      );

      if (errorMarkers instanceof type.errors) {
        console.error("Error validating Monaco markers:", errorMarkers);
        return;
      }
      const edited = editedCode();
      // console.log(`Checking code changes and markers...`, edited.codeState, errorMarkers.length);
      if ((isCodeEventOk(edited) || isCodeEventEdit(edited)) && errorMarkers.length == 0 && val === edited.appCode.code) return; // only check for marker changes if code is the same to avoid infinite loops with Monaco markers updates
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
            code: val,
          },
        });
      } else if (val !== edited.appCode.code || errorMarkers.length === 0) {
        // console.log(`Code is valid, emitting onCode event...`, val.length);
        onCodeChange({
          type: "onCode",
          codeState: edited.codeState === "init" ? "ok" : "edit",
          hasChanged: true,
          appCode: {
            complete: true,
            code: val,
          },
        });
      }
    }
    editorChecker.current = setInterval(refreshState, 500);
    // refreshState();
  }, [onCode, editedCode, monacoReadyRef, editorChecker]);

  useEffect(() => {
    if (!monacoReadyRef.current) return;
    const editor = monacoReadyRef.current.editor;
    if (!appCode.complete) {
      let lastScrollTime = Date.now();
      const scrollThrottleMs = 100;
      const contentDisposable = editor.onDidChangeModelContent(() => {
        const now = Date.now();
        if (now - lastScrollTime > scrollThrottleMs) {
          lastScrollTime = now;
          const model = editor.getModel();
          if (model) {
            const lineCount = model.getLineCount();
            editor.revealLineInCenter(lineCount);
          }
        }
      });
      return () => {
        contentDisposable.dispose();
      };
    }
  }, [monacoReadyRef, appCode]);

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
        <Editor
          height="100%"
          width="100%"
          path="file.jsx"
          defaultLanguage="jsx"
          theme={isDarkMode ? "github-dark-default" : "github-light-default"}
          value={editedCode().appCode.code}
          onChange={handleCodeChange}
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
