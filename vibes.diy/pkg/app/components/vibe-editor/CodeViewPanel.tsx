import React, { useEffect, useState } from "react";
import type { CodeViewModel } from "./code-from-chat.js";

/**
 * Read-only Code tab for the in-page vibe editor (#2518 Phase 1).
 *
 * A file-tab row over syntax-highlighted, scrollable, READ-ONLY source. This
 * deliberately uses shiki (NOT Monaco) so the heavy editor stack stays out of
 * the /vibe first-paint bundle — and shiki itself is loaded via a LAZY dynamic
 * `import("shiki")` so even the highlighter is fetched only when this tab
 * renders. Do not add a top-level `import … from "shiki"` here.
 *
 * File selection is owned here so clicking a file tab actually switches the
 * shown source. The default is `model.activeFile`; a stale picked name (after
 * the model changes to a different vibe) falls back to that default.
 */
export function CodeViewPanel({ model }: { model: CodeViewModel }) {
  const [pickedFileName, setPickedFileName] = useState<string | undefined>(undefined);

  const activeFile = model.files.find((f) => f.fileName === pickedFileName) ?? model.activeFile;
  const activeCode = activeFile ? activeFile.code.join("\n") : model.activeCode;
  const language = activeFile ? activeFile.lang || model.language : model.language;
  const html = useShikiHtml(activeCode, language);

  // Nothing generated yet: no hydrated files AND no streamed source.
  if (model.files.length === 0 && !activeCode) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
        No code yet — make an edit to generate this vibe's source.
      </div>
    );
  }

  const activeFileName = activeFile?.fileName;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {model.files.length > 0 && (
        <div
          role="tablist"
          aria-label="Source files"
          className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
        >
          {model.files.map((file) => {
            const selected = file.fileName === activeFileName;
            return (
              <button
                key={file.fileName}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setPickedFileName(file.fileName)}
                className={
                  "rounded px-2 py-1 font-mono text-xs whitespace-nowrap " +
                  (selected
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200")
                }
              >
                {file.fileName}
              </button>
            );
          })}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-white text-xs dark:bg-gray-950">
        {html ? (
          <div className="vibe-code-shiki [&_pre]:m-0 [&_pre]:p-3" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="m-0 p-3 font-mono text-gray-800 dark:text-gray-200">{activeCode}</pre>
        )}
      </div>
    </div>
  );
}

/**
 * Highlight `code` with shiki, loading the library lazily so it never lands in
 * the /vibe first-paint bundle. Returns `undefined` until the highlight
 * resolves (the caller renders a plain-text fallback meanwhile).
 */
function useShikiHtml(code: string, language: string): string | undefined {
  const [html, setHtml] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    if (!code) {
      setHtml(undefined);
      return;
    }
    void (async () => {
      try {
        const { codeToHtml } = await import("shiki");
        const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
        const out = await codeToHtml(code, {
          lang: language,
          theme: isDark ? "github-dark-default" : "github-light-default",
        });
        if (alive) setHtml(out);
      } catch {
        // Unsupported language or load failure: fall back to plain text.
        if (alive) setHtml(undefined);
      }
    })();
    return () => {
      alive = false;
    };
  }, [code, language]);

  return html;
}
