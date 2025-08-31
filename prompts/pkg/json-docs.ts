import {
  CoerceURI,
  exception2Result,
  ResolveOnce,
  Result,
} from "@adviser/cement";
import { loadAsset } from "./load-asset.js";

export interface LlmCatalogEntry {
  name: string;
  importType?: string;
  label: string;
  llmsTxtUrl?: string; // Optional - if not provided, loads from local repo
  module: string;
  description?: string;
  importModule: string;
  importName: string;
}

export interface JsonDoc<T = LlmCatalogEntry> {
  readonly name: string;
  readonly obj: T;
}

const files = [
  "callai.json",
  "d3.json",
  "fireproof.json",
  "image-gen.json",
  "three-js.json",
  "web-audio.json",
];

export interface JsonDocs {
  "callai.json": JsonDoc;
  "d3.json": JsonDoc;
  "fireproof.json": JsonDoc;
  "image-gen.json": JsonDoc;
  "three-js.json": JsonDoc;
  "web-audio.json": JsonDoc;

  [key: string]: JsonDoc;
}

export const jsonDocs = new ResolveOnce<JsonDocs>();

export function getLlmCatalogNames(
  fallBackUrl: CoerceURI,
): Promise<Set<string>> {
  return getLlmCatalog(fallBackUrl).then(
    (catalog) => new Set(catalog.map((i) => i.name)),
  );
}

export function getLlmCatalog(
  fallBackUrl: CoerceURI,
): Promise<LlmCatalogEntry[]> {
  return getJsonDocArray(fallBackUrl).then((docs) => docs.map((i) => i.obj));
}

export function getJsonDocArray(fallBackUrl: CoerceURI): Promise<JsonDoc[]> {
  return getJsonDocs(fallBackUrl).then((docs) => {
    return Object.values(docs);
  });
}

export async function getJsonDocs(fallBackUrl: CoerceURI): Promise<JsonDocs> {
  return jsonDocs.once(async () => {
    const m: JsonDocs = {} as JsonDocs;
    for (const f of files) {
      const rAsset = await loadAsset(f, fallBackUrl);
      if (rAsset.isErr()) {
        console.error(`Failed to load asset ${f}: ${rAsset.Err()}`);
        continue;
      }
      const rObj = exception2Result(() =>
        JSON.parse(rAsset.Ok()),
      ) as Result<LlmCatalogEntry>;
      if (rObj.isErr()) {
        console.error(
          `Failed to parse JSON from asset ${f}: ${rObj.Err()} [${rAsset.Ok()}]`,
        );
        continue;
      }
      m[f] = { name: f, obj: rObj.Ok() };
    }
    return m;
  });
}
