import type { ImageDocument, VersionInfo, PromptEntry } from "@vibes.diy/use-vibes-types";

export function generateVersionId(versionNumber: number): string {
  return `v${versionNumber}`;
}

export function generatePromptKey(promptNumber: number): string {
  return `p${promptNumber}`;
}

export function getVersionsFromDocument(document: Partial<ImageDocument>): {
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

export function getPromptsFromDocument(document: Partial<ImageDocument>): {
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

export function addNewVersion(document: ImageDocument, assetUrl: string, newPrompt?: string, model?: string): ImageDocument {
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

  return {
    ...document,
    currentVersion: versionCount - 1,
    versions: [
      ...versions,
      { id: newVersionId, created: Date.now(), promptKey: updatedCurrentPromptKey, assetUrl, ...(model ? { model } : {}) },
    ],
    prompts: updatedPrompts,
    currentPromptKey: updatedCurrentPromptKey,
  };
}
