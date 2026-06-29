import type { HydratedCodeViewFile, PromptState } from "../../routes/chat/prompt-state.js";
import { getCode } from "../ResultPreview/get-code.js";
import { inferCodeViewLanguage, pickDefaultCodeViewFile, sortCodeViewFiles } from "../ResultPreview/code-view-files.js";

/**
 * Read-only view model for the Code tab of the in-page vibe editor (#2518
 * Phase 1). A thin composition over the persisted-chat utilities — it does no
 * parsing of its own.
 *
 * Resolution:
 *  - When a hydrated file system is present, render its files (sorted, with a
 *    default selection) just like the existing CodeEditor.
 *  - Otherwise fall back to the streamed `App.jsx` source reconstructed by
 *    `getCode`. For an un-generated vibe that source is empty, so `files` is
 *    `[]`, `activeFile` is `undefined`, and `activeCode` is `""`.
 */
export interface CodeViewModel {
  readonly files: readonly HydratedCodeViewFile[];
  readonly activeFile: HydratedCodeViewFile | undefined;
  readonly activeCode: string;
  readonly language: string;
}

export function resolveCodeView(state: PromptState): CodeViewModel {
  const files = sortCodeViewFiles(state.hydratedFileSystem?.files ?? []);
  const activeFile = pickDefaultCodeViewFile(files);
  if (activeFile) {
    return {
      files,
      activeFile,
      activeCode: activeFile.code.join("\n"),
      language: activeFile.lang || inferCodeViewLanguage(activeFile.fileName, "text/javascript"),
    };
  }
  // No hydrated file system: fall back to the streamed `App.jsx` source.
  const streamed = getCode(state).code;
  return {
    files,
    activeFile: undefined,
    activeCode: streamed.join("\n"),
    language: inferCodeViewLanguage("/App.jsx", "text/javascript"),
  };
}
