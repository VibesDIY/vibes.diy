import { ResolveOnce, pathOps } from "@adviser/cement";
import { loadAsset } from "./load-asset.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TxtDoc {
  readonly name: string;
  readonly txt: string;
}

const files = [
  "callai.txt",
  "fireproof.txt",
  "imageGen.txt",
  "webAudio.txt",
  "d3.md",
  "three-js.md",
];

export interface TxtDocs {
  "fireproof.txt": TxtDoc;
  "imageGen.txt": TxtDoc;
  "webAudio.txt": TxtDoc;
  "d3.md": TxtDoc;
  "three-js.md": TxtDoc;

  [key: string]: TxtDoc;
}

export const txtDocs = new ResolveOnce<TxtDocs>();
export async function getTxtDocs(fallBackUrl: URL): Promise<TxtDocs> {
  return txtDocs.once(async () => {
    const m: TxtDocs = {} as TxtDocs;
    for (const f of files) {
      const rAsset = await loadAsset(pathOps.join("./llms", f), fallBackUrl);
      if (rAsset.isErr()) {
        console.error(`Failed to load asset ${f}: ${rAsset.Err()}`);
        continue;
      }
      m[f] = { name: f, txt: rAsset.Ok() };
    }
    return m;
  });
}

export async function getTexts(
  name: string,
  fallBackUrl: URL,
): Promise<string | undefined> {
  const docs = await getTxtDocs(fallBackUrl);
  return docs[name]?.txt;
}
