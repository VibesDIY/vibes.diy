import { Lazy } from "@adviser/cement";
import { allConfigs } from "./llms/index.js";

export interface TxtDoc {
  readonly name: string;
  readonly txt: string;
}

// Lazy-loaded documentation files for LLM configs
const files = ["callai.txt", "fireproof.txt", "image-gen.txt", "web-audio.txt", "d3.md", "three-js.md", "webxr.md"];

export const getTexts = Lazy(async (): Promise<Map<string, string>> => {
  const docs = new Map<string, string>();
  for (const file of files) {
    try {
      const filename = file.replace(/\.(txt|md)$/, "");
      // Mark as available for lazy loading
      docs.set(filename, file);
    } catch (e) {
      console.warn(`Failed to load ${file}:`, e);
    }
  }
  return docs;
});
