import { isCodeBegin, isCodeLine } from "@vibes.diy/call-ai-v2";
import { Editor } from "@monaco-editor/react";
import type { Monaco } from "@monaco-editor/react";
import fnv1a from "@sindresorhus/fnv1a";
import { editor } from "monaco-editor";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BundledLanguage, BundledTheme, HighlighterGeneric } from "shiki";
import { useParams } from "react-router";
import { useTheme } from "../../contexts/ThemeContext.js";
import { HydratedCodeViewFile, PromptBlock, PromptState } from "../../routes/chat/chat.$ownerHandle.$appSlug.js";
import {
  EditorState,
  EditorStateEdit,
  EditorStateToEdit,
  isEditorStateEdit,
  isEditorStateToEdit,
} from "../../types/code-editor.js";
import { inferCodeViewLanguage, pickDefaultCodeViewFile, sortCodeViewFiles } from "./code-view-files.js";
import { getCode } from "./get-code.js";
import { setupMonacoEditor } from "./setupMonacoEditor.js";
export { getCode } from "./get-code.js";

interface CodeEditorProps {
  promptState: PromptState;
  onCode?: (event: EditorState) => void;
}

interface ChunkContext {
  filePath?: string;
  lines: string[];
}

function normalizeChunkPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

function getLatestChunkContext(blocks: PromptBlock[], selectedFilePath?: string): ChunkContext | null {
  for (let blockIdx = blocks.length - 1; blockIdx >= 0; blockIdx -= 1) {
    const sections = new Map<string, { filePath?: string; lines: string[]; lastSeq: number }>();
    for (const msg of blocks[blockIdx].msgs) {
      if (isCodeBegin(msg)) {
        sections.set(msg.sectionId, {
          filePath: normalizeChunkPath(msg.path),
          lines: [],
          lastSeq: msg.seq,
        });
        continue;
      }
      if (isCodeLine(msg)) {
        const section = sections.get(msg.sectionId);
        if (!section) continue;
        section.lines.push(msg.line);
        section.lastSeq = msg.seq;
      }
    }
    const sectionsByRecency = [...sections.values()]
      .filter((section) => section.lines.length > 0)
      .sort((a, b) => b.lastSeq - a.lastSeq);
    if (sectionsByRecency.length === 0) continue;
    if (selectedFilePath) {
      const selected = sectionsByRecency.find((section) => section.filePath === selectedFilePath);
      if (selected) return selected;
    }
    return sectionsByRecency[0];
  }
  return null;
}

function isDiffMarkerLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("<<<<<<< SEARCH") || trimmed === "=======" || trimmed.startsWith(">>>>>>> REPLACE");
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
  if (isEditorStateToEdit(editorState, { onlyType: true })) {
    const model = ref.current?.editor.getModel();
    ref.current?.editor.setValue(editorState.buffer);
    if (model) {
      const validPosition = model.validatePosition({
        lineNumber: cursorPosition.lineNumber,
        column: cursorPosition.column,
      });
      ref.current?.editor.setPosition(validPosition);
      ref.current?.editor.focus();
    }
    return { ...editorState, cursorPosition };
  }
  if (isEditorStateEdit(editorState, { onlyType: true })) {
    ref.current?.editor.setPosition(cursorPosition);
    return { ...editorState, toEdit: { ...editorState.toEdit, cursorPosition } };
  }
  return editorState as EditorState;
}

function fileButtonClass(isActive: boolean): string {
  if (isActive) {
    return "rounded border border-blue-500/70 bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-900 dark:text-blue-200";
  }
  return "rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800";
}

export function CodeEditor({ promptState, onCode }: CodeEditorProps) {
  const { isDarkMode } = useTheme();
  const { fsId } = useParams<{ fsId?: string }>();

  const monacoReadyRef = useRef<{
    editor: editor.IStandaloneCodeEditor;
    api: Monaco;
  } | null>(null);
  const highlighterRef = useRef<HighlighterGeneric<BundledLanguage, BundledTheme> | null>(null);

  const stateRef = useRef<EditorState>({ state: "idle" });
  function setState(newState: EditorState) {
    stateRef.current = newState;
    onCode?.(newState);
  }

  const hydratedFiles = useMemo(() => {
    if (!fsId) return [] as HydratedCodeViewFile[];
    if (promptState.hydratedFileSystem?.fsId !== fsId) return [] as HydratedCodeViewFile[];
    return sortCodeViewFiles(promptState.hydratedFileSystem.files);
  }, [promptState.hydratedFileSystem, fsId]);

  const defaultHydratedFile = useMemo(() => pickDefaultCodeViewFile(hydratedFiles), [hydratedFiles]);

  const [selectedFileName, setSelectedFileName] = useState<string | undefined>(defaultHydratedFile?.fileName);
  useEffect(() => {
    const defaultPath = defaultHydratedFile?.fileName;
    if (!defaultPath) {
      setSelectedFileName(undefined);
      return;
    }
    setSelectedFileName((prev) => {
      if (prev && hydratedFiles.some((file) => file.fileName === prev)) {
        return prev;
      }
      return defaultPath;
    });
  }, [defaultHydratedFile?.fileName, hydratedFiles]);

  const selectedHydratedFile = useMemo(() => {
    if (hydratedFiles.length === 0) return undefined;
    if (selectedFileName) {
      const bySelection = hydratedFiles.find((file) => file.fileName === selectedFileName);
      if (bySelection) return bySelection;
    }
    return defaultHydratedFile;
  }, [hydratedFiles, selectedFileName, defaultHydratedFile]);

  const streamedCode = getCode(promptState, fsId);

  const activeFile = useMemo(() => {
    if (selectedHydratedFile) {
      return {
        fileName: selectedHydratedFile.fileName,
        lang: selectedHydratedFile.lang,
        code: selectedHydratedFile.code,
        source: "filesystem" as const,
      };
    }
    return {
      fileName: "/App.jsx",
      lang: inferCodeViewLanguage("/App.jsx", "text/javascript"),
      code: streamedCode.code,
      source: "stream" as const,
    };
  }, [selectedHydratedFile, streamedCode.code]);

  const activeBuffer = useMemo(() => activeFile.code.join("\n"), [activeFile.code]);
  const activeHash = useMemo(() => fnv1a(activeBuffer), [activeBuffer]);

  const handleCodeChange = useCallback((nextCode?: string) => {
    setNewCode(nextCode);
  }, []);

  const sourceKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${fsId ?? "none"}:${activeFile.fileName}:${activeHash.toString()}:${activeFile.source}`;
    if (sourceKeyRef.current === key) return;
    sourceKeyRef.current = key;
    setState(
      updateCursorPosition(monacoReadyRef, {
        state: "to-edit",
        buffer: activeBuffer,
        onChange: handleCodeChange,
        hash: activeHash,
        filePath: activeFile.fileName,
        lang: activeFile.lang,
      })
    );
    setNewCode(activeBuffer);
  }, [fsId, activeFile.fileName, activeFile.lang, activeFile.source, activeBuffer, activeHash, handleCodeChange]);

  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      setupMonacoEditor(editor, monaco, {
        isDarkMode,
        setHighlighter: (h) => {
          highlighterRef.current = h as HighlighterGeneric<BundledLanguage, BundledTheme>;
        },
      }).then(() => {
        monacoReadyRef.current = { editor, api: monaco };
        const current = stateRef.current;
        if (isEditorStateToEdit(current) || isEditorStateEdit(current)) {
          editor.setValue(current.buffer);
        }
      });
    },
    [isDarkMode]
  );

  const [newCode, setNewCode] = useState<string | undefined>(undefined);

  useEffect(() => {
    const s = stateRef.current;
    const newHash = fnv1a(newCode ?? "");
    if (isEditorStateToEdit(s) && newHash !== s.hash) {
      setState(
        updateCursorPosition(monacoReadyRef, {
          state: "edit",
          toEdit: s,
          buffer: newCode ?? "",
          hash: newHash,
          filePath: s.filePath,
          lang: s.lang,
        })
      );
    } else if (isEditorStateEdit(s)) {
      if (newHash === s.toEdit.hash) {
        setState(updateCursorPosition(monacoReadyRef, s.toEdit));
      } else if (newHash !== s.hash) {
        setState(updateCursorPosition(monacoReadyRef, { ...s, buffer: newCode ?? "", hash: newHash }));
      }
    }
  }, [newCode]);

  const onChange = isEditorStateToEdit(stateRef.current)
    ? stateRef.current.onChange
    : isEditorStateEdit(stateRef.current)
      ? stateRef.current.toEdit.onChange
      : undefined;

  const diffContext = useMemo(() => {
    if (activeFile.source !== "filesystem") return null;
    const context = getLatestChunkContext(promptState.blocks, activeFile.fileName);
    if (!context) return null;
    if (!context.lines.some((line) => isDiffMarkerLine(line))) return null;
    const maxLines = 14;
    return {
      filePath: context.filePath ?? activeFile.fileName,
      lines: context.lines.slice(0, maxLines),
      truncated: context.lines.length > maxLines,
    };
  }, [activeFile.source, activeFile.fileName, promptState.blocks]);

  return (
    <div data-testid="sandpack-provider" className="flex h-full flex-col" spellCheck={false}>
      {hydratedFiles.length > 1 && (
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/80">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Files</p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {hydratedFiles.map((file) => {
              const isActive = file.fileName === activeFile.fileName;
              return (
                <button
                  key={file.fileName}
                  type="button"
                  className={fileButtonClass(isActive)}
                  onClick={() => setSelectedFileName(file.fileName)}
                  aria-current={isActive ? "page" : undefined}
                  title={file.fileName}
                >
                  {file.fileName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {diffContext && (
        <details className="mx-3 mt-2 rounded-md border border-amber-300 bg-amber-50 text-xs dark:border-amber-800/60 dark:bg-amber-950/30">
          <summary className="cursor-pointer p-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Chat diff context (secondary)
          </summary>
          <div className="px-2 pb-2">
            <p className="mb-1 text-[11px] text-amber-700 dark:text-amber-200">{diffContext.filePath}</p>
            <pre className="max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-4 text-amber-900 dark:text-amber-100">
              {diffContext.lines.join("\n")}
              {diffContext.truncated ? "\n…" : ""}
            </pre>
          </div>
        </details>
      )}

      <div
        className="min-h-0 flex-1"
        style={{
          visibility: "visible",
          position: "static",
          width: "100%",
          top: 0,
          left: 0,
        }}
      >
        <Editor
          height="100%"
          width="100%"
          path={activeFile.fileName}
          language={activeFile.lang}
          theme={isDarkMode ? "github-dark-default" : "github-light-default"}
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
