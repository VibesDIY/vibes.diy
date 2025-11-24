import { CoerceURI, ResolveOnce } from "@adviser/cement";
import { loadDocs } from "./load-docs.js";

// TODO: Replace loadDocs with loadAsset for better cement integration

export interface TxtDoc {
  readonly name: string;
  readonly txt: string;
}

const files = [
  "callai.txt",
  "fireproof.txt",
  "image-gen.txt",
  "web-audio.txt",
  "d3.md",
  "three-js.md",
];

// Lazy loading per file instead of eager loading all files
const fileLoaders = new Map<string, ResolveOnce<TxtDoc | undefined>>();

function getFileLoader(
  file: string,
  fallBackUrl: CoerceURI,
): ResolveOnce<TxtDoc | undefined> {
  const key = `${fallBackUrl?.toString() || ""}:${file}`;
  if (!fileLoaders.has(key)) {
    fileLoaders.set(key, new ResolveOnce<TxtDoc | undefined>());
  }
  const loader = fileLoaders.get(key);
  if (!loader) {
    throw new Error(`File loader not found for key: ${key}`);
  }
  return loader;
}

async function loadTxtDoc(
  file: string,
  fallBackUrl: CoerceURI,
): Promise<TxtDoc | undefined> {
  const loader = getFileLoader(file, fallBackUrl);
  return loader.once(async () => {
    const rAsset = await loadDocs(file, fallBackUrl);
    if (rAsset.isErr()) {
      console.error(`Failed to load asset ${file}: ${rAsset.Err()}`);
      return undefined;
    }
    return { name: file, txt: rAsset.Ok() };
  });
}

export async function getTexts(
  name: string,
  fallBackUrl: CoerceURI,
): Promise<string | undefined> {
  name = name.toLocaleLowerCase().trim();

  // Try exact match first by looking for the file directly
  for (const file of files) {
    const fileName =
      file
        .split("/")
        .pop()
        ?.toLowerCase()
        .replace(/\.(txt|md)$/, "") || "";
    if (fileName === name) {
      const doc = await loadTxtDoc(file, fallBackUrl);
      return doc?.txt;
    }
  }

  return undefined;
}
