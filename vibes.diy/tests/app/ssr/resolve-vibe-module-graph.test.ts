// #2845 cb6: resolveVibeModuleGraph — walk a vibe's relative-import graph into a
// flat, transformed module map keyed for the Worker Loader, rewriting relative
// specifiers to module keys and leaving bare specifiers (react) untouched.

import { describe, it, expect } from "vitest";
import {
  resolveVibeModuleGraph,
  type ResolveSibling,
  type ResolvedVibeModule,
} from "../../../vibe/runtime/resolve-vibe-module-graph.js";

// A resolver backed by an in-memory { path -> raw source } map, with the same
// extension probing the real fsItem-backed resolver does.
function resolverFrom(files: Record<string, string>): ResolveSibling {
  const dirname = (p: string) => (p.lastIndexOf("/") <= 0 ? "/" : p.slice(0, p.lastIndexOf("/")));
  const resolve = (fromDir: string, spec: string) => {
    const segs = fromDir.split("/").filter(Boolean);
    for (const part of spec.split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") segs.pop();
      else segs.push(part);
    }
    return `/${segs.join("/")}`;
  };
  const exts = ["", ".jsx", ".tsx", ".ts", ".js"];
  return async (fromPath, specifier) => {
    const base = resolve(dirname(fromPath), specifier);
    for (const ext of exts) {
      if (files[base + ext] !== undefined) return { path: base + ext, source: files[base + ext] };
    }
    return null;
  };
}

const entry = (source: string): ResolvedVibeModule => ({ path: "/App.jsx", source });

describe("resolveVibeModuleGraph", () => {
  it("collects the entry + a sibling and rewrites the specifier to the sibling key", async () => {
    const graph = await resolveVibeModuleGraph(
      entry(`import { Badge } from "./Badge.jsx"; export default function App(){ return <Badge/>; }`),
      resolverFrom({ "/Badge.jsx": `export function Badge(){ return <span>b</span>; }` })
    );
    expect(graph.entryKey).toBe("App.js");
    expect(Object.keys(graph.modules).sort()).toEqual(["App.js", "Badge.js"]);
    expect(graph.modules["App.js"]).toContain(`"./Badge.js"`);
    expect(graph.modules["App.js"]).not.toContain("Badge.jsx");
    // bare specifiers stay bare (dep modules resolve them)
    expect(graph.modules["App.js"]).toContain("react/jsx-runtime");
  });

  it("walks a transitive, nested graph and rewrites `../` correctly", async () => {
    const graph = await resolveVibeModuleGraph(
      entry(`import { u } from "./lib/util.js"; export default () => <b>{u()}</b>;`),
      resolverFrom({
        "/lib/util.js": `import { k } from "../lib/k.js"; export const u = () => k();`,
        "/lib/k.js": `export const k = () => 1;`,
      })
    );
    expect(Object.keys(graph.modules).sort()).toEqual(["App.js", "lib/k.js", "lib/util.js"]);
    // App.js (root) → lib/util.js
    expect(graph.modules["App.js"]).toContain(`"./lib/util.js"`);
    // lib/util.js → ../lib/k.js resolves to lib/k.js; from dir `lib`, that is `./k.js`
    expect(graph.modules["lib/util.js"]).toContain(`"./k.js"`);
  });

  it("dedupes a diamond (two modules importing the same leaf)", async () => {
    const graph = await resolveVibeModuleGraph(
      entry(`import "./a.js"; import "./b.js"; export default () => null;`),
      resolverFrom({
        "/a.js": `import "./shared.js"; export const a = 1;`,
        "/b.js": `import "./shared.js"; export const b = 2;`,
        "/shared.js": `export const s = 3;`,
      })
    );
    expect(Object.keys(graph.modules).sort()).toEqual(["App.js", "a.js", "b.js", "shared.js"]);
  });

  it("throws on an unresolvable relative import (caller falls back to client-only)", async () => {
    await expect(resolveVibeModuleGraph(entry(`import "./nope.js"; export default () => null;`), resolverFrom({}))).rejects.toThrow(
      /unresolved relative import/
    );
  });
});
