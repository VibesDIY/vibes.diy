import { describe, it, expect } from "vitest";
import { computeStructure } from "./structure.js";

describe("computeStructure", () => {
  it("flags a clean per-object collaboration app (access.js + DSL + can-gating)", () => {
    const files = {
      "App.jsx": [
        `import { useFireproof } from "use-fireproof";`,
        `import { useVibe, useViewer } from "use-vibes";`,
        `export default function App() {`,
        `  const { database, useLiveQuery } = useFireproof("lists");`,
        `  const { can, ready } = useVibe("lists");`,
        `  const { ViewerTag } = useViewer();`,
        `  const onAdd = (draft) => { if (can.create(draft).ok) database.put(draft); };`,
        `  return null;`,
        `}`,
      ].join("\n"),
      "access.js": [
        `export function lists(doc, oldDoc, user, ctx) {`,
        `  if (doc.type === "list") return { channels: [\`list:\${doc._id}\`], grant: { users: [{ user: user.userHandle, channels: [\`list:\${doc._id}\`] }] } };`,
        `  ctx.requireAccess(\`list:\${doc.listId}\`);`,
        `  return { channels: [\`list:\${doc.listId}\`] };`,
        `}`,
      ].join("\n"),
    };
    const s = computeStructure(files);
    expect(s.hasAccessJs).toBe(true);
    expect(s.accessInAppJsx).toBe(false);
    expect(s.usesUseVibe).toBe(true);
    expect(s.gatesOnCan).toBe(true);
    expect(s.usesUseViewer).toBe(true);
    expect(s.usesRequireAccess).toBe(true);
    expect(s.perObjectChannel).toBe(true);
    expect(s.usesFireproof).toBe(true);
  });

  it("detects role gating (owner-publish) without per-object channels", () => {
    const files = {
      "access.js": [
        `export function blog(doc, oldDoc, user, ctx) {`,
        `  ctx.requireRole("owner");`,
        `  return { channels: ["posts"], grant: { public: ["posts"] } };`,
        `}`,
      ].join("\n"),
    };
    const s = computeStructure(files);
    expect(s.usesRequireRole).toBe(true);
    expect(s.usesRequireAccess).toBe(false);
    expect(s.perObjectChannel).toBe(false);
  });

  it("flags the anti-pattern: access logic inside App.jsx and no access.js", () => {
    const files = {
      "App.jsx": [
        `export default function App() {`,
        `  function access(doc, oldDoc, user, ctx) { ctx.requireAccess("x"); throw { forbidden: "no" }; }`,
        `  return null;`,
        `}`,
      ].join("\n"),
    };
    const s = computeStructure(files);
    expect(s.hasAccessJs).toBe(false);
    expect(s.accessInAppJsx).toBe(true);
  });

  it("detects callAI with a schema (structured extraction)", () => {
    const withSchema = {
      "App.jsx": `const r = JSON.parse(await callAI(prompt, { schema: { properties: { items: {} } } }));`,
    };
    const withoutSchema = { "App.jsx": `const r = await callAI("just text");` };
    const noAi = { "App.jsx": `const r = 1 + 1;` };
    expect(computeStructure(withSchema).usesCallAiSchema).toBe(true);
    expect(computeStructure(withSchema).usesCallAi).toBe(true);
    expect(computeStructure(withoutSchema).usesCallAiSchema).toBe(false);
    expect(computeStructure(withoutSchema).usesCallAi).toBe(true);
    expect(computeStructure(noAi).usesCallAi).toBe(false);
  });

  it("is all-false for an empty/missing app", () => {
    const s = computeStructure({});
    expect(s.hasAccessJs).toBe(false);
    expect(s.usesUseVibe).toBe(false);
    expect(s.gatesOnCan).toBe(false);
    expect(s.usesFireproof).toBe(false);
    expect(s.accessInAppJsx).toBe(false);
  });

  it("tolerates a leading-slash file key", () => {
    const s = computeStructure({ "/App.jsx": `const { can } = useVibe("x"); can.edit(doc);` });
    expect(s.usesUseVibe).toBe(true);
    expect(s.gatesOnCan).toBe(true);
  });
});
