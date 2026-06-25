import { describe, it, expect } from "vitest";
import { evaluateProgress } from "./feedback.js";

const goodApp = {
  "App.jsx": `import { useVibe } from "use-vibes";\nexport default function App(){ const {can}=useVibe("x"); can.create({}); return null; }`,
  "access.js": `export function x(doc,old,user,ctx){ ctx.requireAccess("list:"+doc.id); return {channels:[]}; }`,
};

describe("evaluateProgress", () => {
  it("clean when build passes and access.js present for a needsAccess prompt", () => {
    const r = evaluateProgress(goodApp, { ok: true, errors: [] }, true);
    expect(r.clean).toBe(true);
  });
  it("not clean and names the build error", () => {
    const r = evaluateProgress(goodApp, { ok: false, errors: ["App.jsx:3 oops"] }, false);
    expect(r.clean).toBe(false);
    expect(r.message).toMatch(/App\.jsx:3 oops/);
  });
  it("not clean when a needsAccess prompt has no access.js", () => {
    const r = evaluateProgress({ "App.jsx": goodApp["App.jsx"] }, { ok: true, errors: [] }, true);
    expect(r.clean).toBe(false);
    expect(r.message).toMatch(/access\.js/);
  });
  it("ignores access.js requirement when needsAccess is false", () => {
    const r = evaluateProgress({ "App.jsx": goodApp["App.jsx"] }, { ok: true, errors: [] }, false);
    expect(r.clean).toBe(true);
  });
});
