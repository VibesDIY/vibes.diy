import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeAccess } from "./invariants.js";

const habitFormA = `export default function access(doc, oldDoc, user) {
  if (doc.type === "habit") return ctx.requireRole("owner");
  return { channels: ["habits"] };
}`;

const todoPerVisitor = `export default function access(doc, oldDoc, user) {
  if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: true };
  if (doc.authorHandle !== user.userHandle) throw { forbidden: true };
  return { channels: [\`user:\${user.userHandle}\`], grant: { users: { [user.userHandle]: [\`user:\${user.userHandle}\`] } } };
}`;

const blogOwner = `export default function access(doc, oldDoc, user) {
  ctx.requireRole("owner");
  return { channels: ["posts"], grant: { public: ["posts"] } };
}`;

const shopPerObject = `export default function access(doc, oldDoc, user) {
  if (doc.type === "list") {
    return { channels: [\`list:\${doc._id}\`], members: { [\`list:\${doc._id}\`]: [user.userHandle] },
      grant: { users: { [user.userHandle]: [\`list:\${doc._id}\`] } } };
  }
  if (doc.type === "share") { ctx.requireAccess(\`list:\${doc.listId}\`); return { channels: [\`list:\${doc.listId}\`], grant: { users: { [doc.invitee]: [\`list:\${doc.listId}\`] } } }; }
  ctx.requireAccess(\`list:\${doc.listId}\`);
  if (oldDoc && oldDoc.authorHandle !== doc.authorHandle) throw { forbidden: true };
  return { channels: [\`list:\${doc.listId}\`] };
}`;

describe("analyzeAccess", () => {
  it("flags Form-A strict when a non-owner-published core write is gated on requireRole('owner')", () => {
    const a = analyzeAccess(habitFormA, "per-visitor");
    expect(a.formAStrict).toBe(true);
    expect(a.isOwnerWriteGate).toBe(false);
  });
  it("recognizes a clean per-visitor model (author check both create+update, self-grant, no owner gate)", () => {
    const a = analyzeAccess(todoPerVisitor, "per-visitor");
    expect(a.formAStrict).toBe(false);
    expect(a.perVisitorClean).toBe(true);
    expect(a.authorImmutable).toBe(true);
  });
  it("accepts owner-published requireRole('owner') write + public read (not Form-A for this dimension)", () => {
    const a = analyzeAccess(blogOwner, "owner-published");
    expect(a.formAStrict).toBe(false);
    expect(a.ownerPublished).toBe(true);
    expect(a.publicRead).toBe(true);
  });
  it("detects the per-object recipe: object channel + self-grant + member-authored share + requireAccess child + author-immutable", () => {
    const a = analyzeAccess(shopPerObject, "per-object");
    expect(a.objectChannel).toBe(true);
    expect(a.selfGrant).toBe(true);
    expect(a.memberAuthoredShare).toBe(true);
    expect(a.requireAccessChild).toBe(true);
    expect(a.authorImmutable).toBe(true);
    expect(a.perObjectRecipe).toBe(true);
  });
  it("flags an isOwner write-gate anywhere in access.js", () => {
    const a = analyzeAccess(
      `export default function access(doc, oldDoc, user){ if(!user.isOwner) throw {forbidden:true}; return {channels:["x"]}; }`,
      "per-visitor"
    );
    expect(a.isOwnerWriteGate).toBe(true);
  });
});

// --- Corpus regression: the real hand-graded #2588 corpus is ground truth. ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corpusFile = (row: string, slug: string) =>
  readFileSync(path.join(__dirname, "../../../vibes/eval/access-model-2588", row, slug, "access.js"), "utf8");

describe("corpus regression", () => {
  it("row1-todo: textbook per-visitor-private", () => {
    const a = analyzeAccess(corpusFile("row1-todo", "balloon-believed-single"), "per-visitor");
    expect(a.perVisitorClean).toBe(true);
    expect(a.formAStrict).toBe(false);
    expect(a.isOwnerWriteGate).toBe(false);
  });
  it("row2-habit: FAIL Form-A (requireRole('owner') core write)", () => {
    const a = analyzeAccess(corpusFile("row2-habit", "eval-2588-habit"), "per-visitor");
    expect(a.formAStrict).toBe(true);
  });
  it("row3-shop: FAIL per-object (mutable author, no per-object recipe)", () => {
    const a = analyzeAccess(corpusFile("row3-shop", "eval-2588-shop"), "per-object");
    expect(a.perObjectRecipe).toBe(false);
  });
  it("row4-board: FAIL per-object (owner-only membership, no join)", () => {
    const a = analyzeAccess(corpusFile("row4-board", "eval-2588-board"), "per-object");
    expect(a.formABroad).toBe(true);
  });
  it("row5-blog: PASS owner-published + public read", () => {
    const a = analyzeAccess(corpusFile("row5-blog", "eval-2588-blog"), "owner-published");
    expect(a.ownerPublished).toBe(true);
    expect(a.publicRead).toBe(true);
  });
  it("row6-guest: PASS author-owned", () => {
    const a = analyzeAccess(corpusFile("row6-guest", "eval-2588-guest"), "author-owned");
    expect(a.authorOwned).toBe(true);
  });
  it("row7-photo: PASS author-owned comments", () => {
    const a = analyzeAccess(corpusFile("row7-photo", "eval-2588-photo"), "author-owned");
    expect(a.authorOwned).toBe(true);
  });
  it("row8-team: multi-tier reachable (lenient; no isOwner write-gate)", () => {
    const a = analyzeAccess(corpusFile("row8-team", "eval-2588-team"), "multi-tier");
    expect(a.isOwnerWriteGate).toBe(false);
  });
});
