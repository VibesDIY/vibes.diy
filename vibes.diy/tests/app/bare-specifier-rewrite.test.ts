import { describe, it, expect, afterEach } from "vitest";
import { rewriteBareSpecifiers, rewriteRelativeSpecifiers, getActiveImportMap, entryDirBase } from "@vibes.diy/vibe-runtime";

describe("rewriteBareSpecifiers", () => {
  it("rewrites a bare specifier not in the import map to esm.sh", () => {
    const code = `import * as THREE from "three";\nexport default () => null;`;
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain('from "https://esm.sh/three"');
  });

  it("leaves bare specifiers that are mapped untouched", () => {
    const code = `import { useState } from "react";`;
    const out = rewriteBareSpecifiers(code, { react: "https://esm.sh/react@19.2.1" });
    expect(out).toBe(code);
  });

  it("leaves relative paths and absolute URLs untouched", () => {
    const code = [
      `import a from "./a.js";`,
      `import b from "../b.js";`,
      `import c from "/c.js";`,
      `import d from "https://example.com/d.js";`,
      `import e from "blob:https://x/uuid";`,
    ].join("\n");
    expect(rewriteBareSpecifiers(code, {})).toBe(code);
  });

  it("host-swaps a hardcoded unpkg URL to esm.sh (issue #1735)", () => {
    const code = `import { callAI } from "https://unpkg.com/call-ai@latest/dist/call-ai.js";\nexport default () => null;`;
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain('from "https://esm.sh/call-ai@latest/dist/call-ai.js"');
    expect(out).not.toContain("unpkg.com");
  });

  it("host-swaps a side-effect unpkg import", () => {
    const code = `import "https://unpkg.com/some-lib/dist/style.css";\nconsole.log("ok");`;
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain('import "https://esm.sh/some-lib/dist/style.css"');
  });

  it("preserves query and hash when host-swapping unpkg URLs", () => {
    const code = `import x from "https://unpkg.com/pkg@1.0.0/dist/x.js?module#frag";`;
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain('from "https://esm.sh/pkg@1.0.0/dist/x.js?module#frag"');
  });

  it("leaves CORS-friendly CDN URLs (jsdelivr, esm.sh) untouched", () => {
    const code = [`import a from "https://cdn.jsdelivr.net/npm/pkg@1/dist/a.js";`, `import b from "https://esm.sh/three";`].join(
      "\n"
    );
    expect(rewriteBareSpecifiers(code, {})).toBe(code);
  });

  it("honors the trailing-slash prefix rule in the import map", () => {
    const code = `import x from "ag-grid-community/styles/ag-grid.css";`;
    const out = rewriteBareSpecifiers(code, {
      "ag-grid-community/": "https://esm.sh/ag-grid-community@35.1.0/",
    });
    expect(out).toBe(code);
  });

  it("does not rewrite dynamic import() in the module body", () => {
    // Dynamic imports in the body are intentionally out of scope — the
    // rewriter only touches the top-of-file import region to keep clear of
    // string literals and comments in user code.
    const code = `import { useState } from "react";\nconst m = await import("chart.js");`;
    const out = rewriteBareSpecifiers(code, { react: "https://esm.sh/react@19.2.1" });
    expect(out).toContain(`import("chart.js")`);
    expect(out).not.toContain("https://esm.sh/chart.js");
  });

  it("rewrites side-effect imports", () => {
    const code = `import "tone";\nconsole.log("ok");`;
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain('import "https://esm.sh/tone"');
  });

  it("rewrites multi-line imports with line breaks inside braces", () => {
    const code = [`import {`, `  Canvas,`, `  useFrame,`, `} from "@react-three/fiber";`, `export default () => null;`].join("\n");
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain('from "https://esm.sh/@react-three/fiber"');
    expect(out).not.toContain('from "@react-three/fiber"');
  });

  it("does not rewrite import-like text in the module body", () => {
    const code = [
      `import { useState } from "react";`,
      ``,
      `function App() {`,
      `  // import "three" — this is just a comment`,
      `  const msg = 'load from "three"';`,
      `  return msg;`,
      `}`,
    ].join("\n");
    const out = rewriteBareSpecifiers(code, { react: "https://esm.sh/react@19.2.1" });
    expect(out).toContain('from "react"');
    expect(out).not.toContain("https://esm.sh/three");
    expect(out).toContain(`'load from "three"'`);
    expect(out).toContain(`// import "three"`);
  });

  it("skips top-of-file block comments and rewrites the imports below", () => {
    const code = [`/**`, ` * banner`, ` */`, `import * as THREE from "three";`, `export default () => null;`].join("\n");
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain('from "https://esm.sh/three"');
  });

  it("preserves single-quote style", () => {
    const code = `import x from 'three';`;
    const out = rewriteBareSpecifiers(code, {});
    expect(out).toContain("from 'https://esm.sh/three'");
  });

  it("handles a mix of mapped and unmapped imports in one source", () => {
    const code = [
      `import { useState } from "react";`,
      `import * as THREE from "three";`,
      `import "./styles.css";`,
      `import "tone";`,
      `export default function App() { return null; }`,
    ].join("\n");
    const out = rewriteBareSpecifiers(code, { react: "https://esm.sh/react@19.2.1" });
    expect(out).toContain('from "react"');
    expect(out).toContain('from "https://esm.sh/three"');
    expect(out).toContain('import "./styles.css"');
    expect(out).toContain('import "https://esm.sh/tone"');
  });
});

describe("rewriteRelativeSpecifiers (#1889)", () => {
  const base = "https://app--user.cli-v2.vibesdiy.net/~abc123~/";

  it("rewrites ./Sibling.jsx to an absolute URL against the entry base", () => {
    const code = `import Badge from "./Badge.jsx";\nexport default () => null;`;
    const out = rewriteRelativeSpecifiers(code, base);
    expect(out).toContain(`from "https://app--user.cli-v2.vibesdiy.net/~abc123~/Badge.jsx"`);
    expect(out).not.toContain(`from "./Badge.jsx"`);
  });

  it("resolves ../ and / specifiers against the base origin", () => {
    const code = [`import a from "../shared/a.js";`, `import b from "/helpers.js";`, `export default () => null;`].join("\n");
    const out = rewriteRelativeSpecifiers(code, base);
    expect(out).toContain(`from "https://app--user.cli-v2.vibesdiy.net/shared/a.js"`);
    expect(out).toContain(`from "https://app--user.cli-v2.vibesdiy.net/helpers.js"`);
  });

  it("rewrites side-effect and dynamic relative imports in the import region", () => {
    const code = [`import "./styles.css";`, `import("./lazy.js");`, `export default () => null;`].join("\n");
    const out = rewriteRelativeSpecifiers(code, base);
    expect(out).toContain(`import "https://app--user.cli-v2.vibesdiy.net/~abc123~/styles.css"`);
    expect(out).toContain(`import("https://app--user.cli-v2.vibesdiy.net/~abc123~/lazy.js")`);
  });

  it("leaves bare specifiers and absolute URLs untouched", () => {
    const code = [
      `import { useState } from "react";`,
      `import x from "https://esm.sh/three";`,
      `import e from "blob:https://x/uuid";`,
      `export default () => null;`,
    ].join("\n");
    expect(rewriteRelativeSpecifiers(code, base)).toBe(code);
  });

  it("is a no-op when no base URL is available", () => {
    const code = `import Badge from "./Badge.jsx";`;
    expect(rewriteRelativeSpecifiers(code, undefined)).toBe(code);
  });

  it("does not touch relative-looking text in the module body", () => {
    const code = [
      `import Badge from "./Badge.jsx";`,
      ``,
      `function App() {`,
      `  const href = "./not-an-import";`,
      `  return href;`,
      `}`,
    ].join("\n");
    const out = rewriteRelativeSpecifiers(code, base);
    expect(out).toContain(`from "https://app--user.cli-v2.vibesdiy.net/~abc123~/Badge.jsx"`);
    expect(out).toContain(`"./not-an-import"`);
  });
});

describe("entryDirBase (#1889)", () => {
  const origin = "https://app--user.cli-v2.vibesdiy.net";

  it("turns the trailing-slash-less /~fsId~ entry path into the fsId directory", () => {
    // calcEntryPointUrl emits /~fsId~ with NO trailing slash, so this is the
    // exact case Codex flagged: resolving against the raw path would drop the
    // fsId. entryDirBase must yield the /~fsId~/ directory instead.
    expect(entryDirBase(origin, "/~zABCDEFGH~")).toBe(`${origin}/~zABCDEFGH~/`);
  });

  it("accepts an already-trailing-slash entry path", () => {
    expect(entryDirBase(origin, "/~zABCDEFGH~/")).toBe(`${origin}/~zABCDEFGH~/`);
  });

  it("returns undefined for a non-fsId path (e.g. the pending bare-host shell)", () => {
    expect(entryDirBase(origin, "/")).toBeUndefined();
  });

  it("resolves a sibling against the /~fsId~ entry path to the fsId directory, not the origin root", () => {
    // End-to-end of the Codex scenario: pinned-fsId iframe, raw entry path.
    const base = entryDirBase(origin, "/~zABCDEFGH~");
    const out = rewriteRelativeSpecifiers(`import Badge from "./Badge.jsx";`, base);
    expect(out).toContain(`from "${origin}/~zABCDEFGH~/Badge.jsx"`);
    expect(out).not.toContain(`from "${origin}/Badge.jsx"`);
  });
});

describe("getActiveImportMap", () => {
  afterEach(() => {
    document.head.querySelectorAll('script[type="importmap"]').forEach((el) => el.remove());
  });

  it("returns an empty object when no importmap script exists", () => {
    expect(getActiveImportMap()).toEqual({});
  });

  it("returns the imports object when an importmap script is present", () => {
    const el = document.createElement("script");
    el.type = "importmap";
    el.textContent = JSON.stringify({ imports: { react: "https://esm.sh/react@19.2.1" } });
    document.head.appendChild(el);
    expect(getActiveImportMap()).toEqual({ react: "https://esm.sh/react@19.2.1" });
  });

  it("returns an empty object when the importmap has no imports field", () => {
    const el = document.createElement("script");
    el.type = "importmap";
    el.textContent = JSON.stringify({ scopes: {} });
    document.head.appendChild(el);
    expect(getActiveImportMap()).toEqual({});
  });
});
