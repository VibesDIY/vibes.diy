import { shikiToMonaco } from "@shikijs/monaco";
import { createHighlighterCore, HighlighterCore } from "shiki/core";
import langJavaScript from "shiki/langs/javascript.mjs";
import langTypeScript from "shiki/langs/typescript.mjs";
import langJsx from "shiki/langs/jsx.mjs";
import langTsx from "shiki/langs/tsx.mjs";
import themeGithubDark from "shiki/themes/github-dark-default.mjs";
import themeGithubLite from "shiki/themes/github-light-default.mjs";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type React from "react";
import * as monaco from "monaco-editor";
import { Monaco } from "@monaco-editor/react";

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

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: "React.createElement",
    reactNamespace: "React",
    allowNonTsExtensions: true,
    allowJs: true,
    target: monaco.languages.typescript.ScriptTarget.Latest,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    esModuleInterop: true,
    skipLibCheck: true,
  });

  // Enable syntax error detection for JavaScript/JSX
  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false, // Enable semantic validation
    noSyntaxValidation: false, // Enable syntax error detection
  });

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
    const highlighter = await createHighlighterCore({
      themes: [themeGithubDark, themeGithubLite],
      // langs: ["javascript", "jsx", "typescript", "tsx"],
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
