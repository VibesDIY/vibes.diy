export interface CodeViewFileLike {
  fileName: string;
  entryPoint?: boolean;
}

const INTERNAL_PATH_PREFIXES = ["/~~transformed~~/", "/~~calculated~~/"];

const CODE_VIEW_TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".json",
  ".md",
  ".txt",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".svg",
]);

const MIME_LANGUAGE: Record<string, string> = {
  "application/importmap+json": "json",
  "application/javascript": "javascript",
  "application/json": "json",
  "application/typescript": "typescript",
  "application/x-typescript": "typescript",
  "image/svg+xml": "xml",
  "text/css": "css",
  "text/html": "html",
  "text/javascript": "javascript",
  "text/json": "json",
  "text/markdown": "markdown",
  "text/typescript": "typescript",
  "text/x-typescript": "typescript",
  "text/yaml": "yaml",
};

const EXTENSION_LANGUAGE: Record<string, string> = {
  ".cjs": "javascript",
  ".css": "css",
  ".html": "html",
  ".js": "javascript",
  ".json": "json",
  ".jsx": "javascript",
  ".less": "less",
  ".md": "markdown",
  ".mjs": "javascript",
  ".sass": "scss",
  ".scss": "scss",
  ".svg": "xml",
  ".toml": "ini",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
};

function extensionOf(fileName: string): string {
  const normalized = normalizeCodeViewPath(fileName).toLowerCase();
  const dot = normalized.lastIndexOf(".");
  return dot >= 0 ? normalized.slice(dot) : "";
}

function isLikelyTextMime(mimeType: string): boolean {
  if (!mimeType) return false;
  if (mimeType.startsWith("text/")) return true;
  return mimeType in MIME_LANGUAGE;
}

export function normalizeCodeViewPath(fileName: string): string {
  if (fileName.startsWith("/")) return fileName;
  return `/${fileName}`;
}

export function isCodeViewFileCandidate(fileName: string, mimeType: string): boolean {
  const normalized = normalizeCodeViewPath(fileName);
  if (INTERNAL_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  return CODE_VIEW_TEXT_EXTENSIONS.has(extensionOf(normalized)) || isLikelyTextMime(mimeType);
}

export function inferCodeViewLanguage(fileName: string, mimeType: string): string {
  const ext = extensionOf(fileName);
  if (EXTENSION_LANGUAGE[ext]) {
    return EXTENSION_LANGUAGE[ext];
  }
  const mime = mimeType.toLowerCase();
  if (MIME_LANGUAGE[mime]) {
    return MIME_LANGUAGE[mime];
  }
  return "plaintext";
}

export function sortCodeViewFiles<T extends CodeViewFileLike>(files: readonly T[]): T[] {
  return [...files].sort((a, b) => {
    const aPath = normalizeCodeViewPath(a.fileName);
    const bPath = normalizeCodeViewPath(b.fileName);
    if (!!a.entryPoint !== !!b.entryPoint) {
      return a.entryPoint ? -1 : 1;
    }
    if (aPath === "/App.jsx" && bPath !== "/App.jsx") return -1;
    if (bPath === "/App.jsx" && aPath !== "/App.jsx") return 1;
    return aPath.localeCompare(bPath);
  });
}

export function pickDefaultCodeViewFile<T extends CodeViewFileLike>(files: readonly T[]): T | undefined {
  const sorted = sortCodeViewFiles(files);
  return sorted[0];
}
