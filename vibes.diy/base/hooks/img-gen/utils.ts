import type { FileMeta, VersionInfo, PromptEntry, PartialImageDocument } from "@vibes.diy/vibe-types";

// Doc shape recap (Seam G4):
//   versions[N].id IS the fileKey into _files (e.g. "v1" -> _files.v1).
//   _files.v<N> = { uploadId, type, size, lastModified? } (FileMeta).
//   prompts[promptKey] = { text, created }; currentPromptKey points
//   into prompts. The platform's URL minter adds `meta.url` on read.

export function generateVersionId(versionNumber: number): string {
  return `v${versionNumber}`;
}

export function generatePromptKey(promptNumber: number): string {
  return `p${promptNumber}`;
}

export function getVersionsFromDocument(document: PartialImageDocument | null | undefined): {
  versions: VersionInfo[];
  currentVersion: number;
} {
  if (document?.versions && document.versions.length > 0) {
    return {
      versions: document.versions,
      currentVersion: document.currentVersion ?? document.versions.length - 1,
    };
  }
  return { versions: [], currentVersion: 0 };
}

export function getPromptsFromDocument(document: PartialImageDocument | null | undefined): {
  prompts: Record<string, PromptEntry>;
  currentPromptKey: string;
} {
  if (document?.prompts && document?.currentPromptKey) {
    return {
      prompts: document.prompts,
      currentPromptKey: document.currentPromptKey,
    };
  }
  if (document?.prompt) {
    return {
      prompts: { p1: { text: document.prompt, created: document.created || Date.now() } },
      currentPromptKey: "p1",
    };
  }
  return { prompts: {}, currentPromptKey: "" };
}

// Append a new version, writing the file ref into `_files.<versionId>`
// rather than carrying a URL string on the version. The version's `id`
// IS the fileKey — there's no separate fileKey field. Stage C's URL
// minter resolves `_files.<versionId>.url` on read.
export function addNewVersion(
  document: PartialImageDocument,
  fileMeta: FileMeta,
  newPrompt?: string,
  model?: string
): PartialImageDocument & { _files: Record<string, FileMeta>; versions: VersionInfo[] } {
  const { versions } = getVersionsFromDocument(document);
  const versionCount = versions.length + 1;
  const newVersionId = generateVersionId(versionCount);

  const { prompts, currentPromptKey } = getPromptsFromDocument(document);
  const updatedPrompts = { ...prompts };
  let updatedCurrentPromptKey = currentPromptKey;

  if (newPrompt && (!currentPromptKey || newPrompt !== prompts[currentPromptKey]?.text)) {
    const promptCount = Object.keys(updatedPrompts).length + 1;
    updatedCurrentPromptKey = generatePromptKey(promptCount);
    updatedPrompts[updatedCurrentPromptKey] = { text: newPrompt, created: Date.now() };
  } else if (!updatedCurrentPromptKey && document.prompt) {
    updatedCurrentPromptKey = "p1";
    updatedPrompts["p1"] = { text: document.prompt, created: document.created || Date.now() };
  }

  // Strip non-cloneable properties (e.g. Fireproof's hydrated `.file()`
  // accessor) from existing `_files` entries before re-putting. The
  // closure can't be structured-cloned across the iframe postMessage
  // bridge — it surfaces as DataCloneError. Only carry the data fields.
  const updatedFiles: Record<string, FileMeta> = {};
  for (const [key, value] of Object.entries(document._files ?? {})) {
    if (!value || typeof value !== "object") continue;
    const v = value as Partial<FileMeta> & { cid?: string };
    updatedFiles[key] = {
      uploadId: v.uploadId ?? "",
      type: v.type ?? "application/octet-stream",
      size: v.size ?? 0,
      ...(v.lastModified !== undefined ? { lastModified: v.lastModified } : {}),
      ...(v.url !== undefined ? { url: v.url } : {}),
    };
  }
  updatedFiles[newVersionId] = fileMeta;

  return {
    ...document,
    type: "image",
    currentVersion: versionCount - 1,
    versions: [
      ...versions,
      { id: newVersionId, created: Date.now(), promptKey: updatedCurrentPromptKey, ...(model ? { model } : {}) },
    ],
    prompts: updatedPrompts,
    currentPromptKey: updatedCurrentPromptKey,
    _files: updatedFiles,
  };
}
