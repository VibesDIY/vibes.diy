import { Lazy } from "@adviser/cement";
import { allConfigs } from "./llms/index.js";
import type { LlmConfig } from "./llms/index.js";

// Re-export the types for compatibility
export type { LlmConfig as LlmCatalogEntry } from "./llms/index.js";

export interface JsonDoc<T = LlmConfig> {
  readonly name: string;
  readonly obj: T;
}

export interface JsonDocs {
  "callai.json": JsonDoc;
  "d3.json": JsonDoc;
  "fireproof.json": JsonDoc;
  "image-gen.json": JsonDoc;
  "three-js.json": JsonDoc;
  "web-audio.json": JsonDoc;

  [key: string]: JsonDoc;
}

export function getLlmCatalogNames(): Promise<Set<string>> {
  return getLlmCatalog().then((catalog) => new Set(catalog.map((i) => i.name)));
}

export function getLlmCatalog(): Promise<LlmConfig[]> {
  return getJsonDocArray().then((docs) => docs.map((i) => i.obj));
}

export function getJsonDocArray(): Promise<JsonDoc[]> {
  return getJsonDocs().then((docs) => {
    return Object.values(docs);
  });
}

export const getJsonDocs = Lazy(async (): Promise<JsonDocs> => {
  const m: JsonDocs = {} as JsonDocs;

  // Load configs from TypeScript modules instead of fetching JSON
  for (const config of allConfigs) {
    const filename = `${config.name}.json`;
    m[filename] = { name: filename, obj: config };
  }
  return m;
});
