import { shikiToMonaco } from "@shikijs/monaco";
import { createHighlighterCore, HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type React from "react";
import * as monaco from "monaco-editor";
import { Monaco } from "@monaco-editor/react";

// Monaco's DiagnosticsOptions type is not directly exportable due to module structure
// Define the interface based on actual runtime API
export interface MonacoDiagnosticsOptions {
  noSemanticValidation?: boolean;
  noSyntaxValidation?: boolean;
  noSuggestionDiagnostics?: boolean;
  diagnosticCodesToIgnore?: number[];
}

export interface MonacoDiagnosticsDefaults {
  setDiagnosticsOptions: (options: MonacoDiagnosticsOptions) => void;
  getDiagnosticsOptions?: () => MonacoDiagnosticsOptions | undefined;
}

interface Options {
  isStreaming: boolean;
  codeReady: boolean;
  isDarkMode: boolean;
  userScrolledRef: React.MutableRefObject<boolean>;
  disposablesRef: React.MutableRefObject<{ dispose: () => void }[]>;
  setRefs: (
    editor: monaco.editor.IStandaloneCodeEditor,
    monaco: Monaco,
  ) => void;
  setHighlighter: (highlighter: HighlighterCore) => void;
}

/**
 * Derive diagnostics options for the current code readiness state.
 *
 * This helper always overwrites `noSemanticValidation` and
 * `noSyntaxValidation` based on `codeReady`, while preserving any
 * other existing diagnostics flags from `previous`.
 */
export function diagnosticsForCodeReady(
  codeReady: boolean,
  previous?: MonacoDiagnosticsOptions,
): MonacoDiagnosticsOptions {
  const {
    noSemanticValidation: _prevSemantic,
    noSyntaxValidation: _prevSyntax,
    ...rest
  } = previous ?? {};

  return {
    ...rest,
    noSemanticValidation: !codeReady,
    noSyntaxValidation: !codeReady,
  };
}

export async function setupMonacoEditor(
  editor: monaco.editor.IStandaloneCodeEditor,
  monaco: Monaco,
  {
    isStreaming,
    codeReady,
    isDarkMode,
    userScrolledRef,
    disposablesRef,
    setRefs,
    setHighlighter,
  }: Options,
) {
  setRefs(editor, monaco);

  const ts = monaco.languages.typescript;

  ts.javascriptDefaults.setCompilerOptions({
    jsx: ts.JsxEmit.React,
    jsxFactory: "React.createElement",
    reactNamespace: "React",
    allowNonTsExtensions: true,
    allowJs: true,
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    skipLibCheck: true,
  });

  // Configure syntax and semantic validation based on initial code readiness.
  // When the code is still streaming/incomplete (`codeReady === false`), we
  // disable diagnostics to avoid noisy red squiggles. A React effect in
  // `IframeContent` will update these options as `codeReady` changes over time.
  const jsDefaults = ts.javascriptDefaults as MonacoDiagnosticsDefaults;
  const currentDiagnostics = jsDefaults.getDiagnosticsOptions?.();

  jsDefaults.setDiagnosticsOptions(
    diagnosticsForCodeReady(codeReady, currentDiagnostics),
  );

  editor.updateOptions({
    tabSize: 2,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true },
  });

  monaco.languages.register({ id: "jsx" });
  monaco.languages.register({ id: "javascript" });

  if (isStreaming && !codeReady) {
    let lastScrollTime = Date.now();
    const scrollThrottleMs = 30;
    const contentDisposable = editor.onDidChangeModelContent(() => {
      const now = Date.now();
      if (now - lastScrollTime > scrollThrottleMs && !userScrolledRef.current) {
        lastScrollTime = now;
        const model = editor.getModel();
        if (model) {
          const lineCount = model.getLineCount();
          editor.revealLineNearTop(lineCount);
        }
      }
    });
    disposablesRef.current.push(contentDisposable);
  }

  try {
    // Dynamically import language and theme modules to avoid bundling issues
    const [
      { default: langJavaScript },
      { default: langTypeScript },
      { default: langJsx },
      { default: langTsx },
      { default: themeGithubDark },
      { default: themeGithubLite },
    ] = await Promise.all([
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/jsx.mjs"),
      import("shiki/langs/tsx.mjs"),
      import("shiki/themes/github-dark-default.mjs"),
      import("shiki/themes/github-light-default.mjs"),
    ]);

    const highlighter = await createHighlighterCore({
      themes: [themeGithubDark, themeGithubLite],
      langs: [langJavaScript, langJsx, langTypeScript, langTsx],
      engine: createOnigurumaEngine(() => import("shiki/wasm")),
    });
    setHighlighter(highlighter);
    await shikiToMonaco(highlighter, monaco);
    const currentTheme = isDarkMode
      ? "github-dark-default"
      : "github-light-default";
    monaco.editor.setTheme(currentTheme);
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, "javascript");
    }
  } catch (error) {
    console.warn("Shiki highlighter setup failed:", error);
  }

  editor.onDidScrollChange(() => {
    const model = editor.getModel();
    if (model) {
      const totalLines = model.getLineCount();
      const visibleRanges = editor.getVisibleRanges();
      if (visibleRanges.length > 0) {
        const lastVisibleLine = visibleRanges[0].endLineNumber;
        if (lastVisibleLine >= totalLines - 2) {
          userScrolledRef.current = false;
        }
      }
    }
  });

  const domNode = editor.getDomNode();
  if (domNode) {
    const wheelListener = () => {
      const model = editor.getModel();
      if (model) {
        const totalLines = model.getLineCount();
        const visibleRanges = editor.getVisibleRanges();
        if (visibleRanges.length > 0) {
          const lastVisibleLine = visibleRanges[0].endLineNumber;
          if (lastVisibleLine < totalLines - 2) {
            userScrolledRef.current = true;
          }
        }
      }
    };
    domNode.addEventListener("wheel", wheelListener);
    disposablesRef.current.push({
      dispose: () => domNode.removeEventListener("wheel", wheelListener),
    });
  }
}
