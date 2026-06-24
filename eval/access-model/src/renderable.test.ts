import { describe, it, expect } from "vitest";
import { checkFiles } from "./renderable.js";

describe("checkFiles", () => {
  it("twoFile=false when access.js is missing or trivial", () => {
    expect(checkFiles({ "App.jsx": "export default function App(){return null}" }).twoFile).toBe(false);
  });
  it("twoFile=true when both present and non-trivial", () => {
    const r = checkFiles({ "App.jsx": "export default function App(){return <div/>}", "access.js": "export default function access(d,o,u){return {channels:['x']}}" });
    expect(r.twoFile).toBe(true);
  });
  it("renderable=false on duplicate import (ESM redeclaration)", () => {
    const app = `import { useFireproof } from "use-fireproof";\nimport { useFireproof } from "use-fireproof";\nexport default function App(){return <div/>}`;
    expect(checkFiles({ "App.jsx": app, "access.js": "export default function access(){}" }).renderable).toBe(false);
  });
  it("renderable=false when App.jsx actually contains the access fn (filename clobber)", () => {
    const app = `export default function access(doc, oldDoc, user){ return {channels:['x']} }`;
    expect(checkFiles({ "App.jsx": app, "access.js": "x" }).renderable).toBe(false);
  });
});
