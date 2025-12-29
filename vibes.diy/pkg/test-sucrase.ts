import { readFile } from "fs/promises";
import { transformString, extractImports } from "./transform-sucrase.js";

const code = await readFile("index.tsx", "utf-8");

try {
  const deps = extractImports(code);
  const out = transformString(code, "index.tsx");
  console.log("SUCCESS");
  console.log("Deps:", deps);
  console.log("Output length:", out.length);
} catch (e) {
  console.error("ERROR:", e instanceof Error ? e.message : e);
}
