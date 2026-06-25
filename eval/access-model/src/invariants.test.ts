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

// The retired dead-end (#2631): requireRole("owner") gates the CONTENT post — nobody but the
// owner can ever publish. No longer accepted for owner-published.
const blogOwnerOnly = `export default function access(doc, oldDoc, user) {
  ctx.requireRole("owner");
  return { channels: ["posts"], grant: { public: ["posts"] } };
}`;

// The corrected shape (#2631): the owner approves authors (requireRole("owner") ONLY on the
// roster grant), posts are author-owned + membership-gated, reads public.
const blogApproveAuthors = `export default function access(doc, oldDoc, user, ctx) {
  if (doc.type === "author") {
    ctx.requireRole("owner");
    return { channels: ["blog:authors"], grant: { users: { [doc.authorHandle]: ["blog:authors"] }, roles: { owner: ["blog:authors"] } } };
  }
  if (doc.type === "post") {
    ctx.requireAccess("blog:authors");
    if (doc.authorHandle !== user.userHandle) throw { forbidden: true };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: true };
    return { channels: ["blog"], grant: { public: ["blog"] } };
  }
  return { channels: ["blog"], grant: { public: ["blog"] } };
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
  it("rejects owner-only-content as the retired dead-end (#2631): requireRole('owner') on the post itself", () => {
    const a = analyzeAccess(blogOwnerOnly, "owner-published");
    expect(a.formAStrict).toBe(false); // owner-published is not a multiplayer dimension
    expect(a.ownerOnlyContent).toBe(true);
    expect(a.authorRosterGrant).toBe(false);
    expect(a.ownerPublished).toBe(false); // no longer accepted
  });
  it("accepts owner-approves-authors (#2631): roster grant gated on requireRole('owner') + author-owned posts + public read", () => {
    const a = analyzeAccess(blogApproveAuthors, "owner-published");
    expect(a.authorRosterGrant).toBe(true); // requireRole('owner') belongs ONLY here
    expect(a.ownerOnlyContent).toBe(false);
    expect(a.authorImmutable).toBe(true); // posts are author-owned
    expect(a.publicRead).toBe(true);
    expect(a.ownerPublished).toBe(true);
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
  it("detects the author-on-create check in the reversed `user === doc` order (#2621)", () => {
    const reversed = `export default function access(doc, oldDoc, user) {
      if (user.userHandle !== doc.authorHandle) throw { forbidden: true };
      if (oldDoc && user.userHandle !== oldDoc.authorHandle) throw { forbidden: true };
      return { channels: [\`user:\${user.userHandle}\`], grant: { users: { [user.userHandle]: [\`user:\${user.userHandle}\`] } } };
    }`;
    const a = analyzeAccess(reversed, "per-visitor");
    expect(a.authorCheckCreate).toBe(true);
    expect(a.authorImmutable).toBe(true);
    expect(a.perVisitorClean).toBe(true);
  });
  it("does NOT treat a read-only oldDoc.author mention as an immutability check (#2621)", () => {
    const readonlyMention = `export default function access(doc, oldDoc, user) {
      const previousAuthor = oldDoc.authorHandle; // read-only, no comparison
      return { channels: ["notes"], audit: previousAuthor };
    }`;
    const a = analyzeAccess(readonlyMention, "per-visitor");
    expect(a.authorImmutable).toBe(false);
  });

  it("detects the `type === 'request'` / 'share' branches the prompt examples teach (#2631 regex fix)", () => {
    const join = `export default function access(doc, oldDoc, user, ctx) {
      const ch = "board:" + doc.boardId;
      if (doc.type === "request") return { channels: [ch] };
      ctx.requireAccess(ch);
      return { channels: [ch] };
    }`;
    const ja = analyzeAccess(join, "per-object");
    expect(ja.joinPath).toBe(true);

    const share = `export default function access(doc, oldDoc, user, ctx) {
      const ch = "board:" + doc.boardId;
      if (doc.type === "share") { ctx.requireAccess(ch); return { channels: [ch], grant: { users: { [doc.invitee]: [ch] } } }; }
      ctx.requireAccess(ch);
      return { channels: [ch] };
    }`;
    const sa = analyzeAccess(share, "per-object");
    expect(sa.memberAuthoredShare).toBe(true);
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
  it("row5-blog: PASS owner-published — owner approves authors, posts author-owned, public read (#2631)", () => {
    const a = analyzeAccess(corpusFile("row5-blog", "eval-2588-blog"), "owner-published");
    expect(a.ownerPublished).toBe(true);
    expect(a.publicRead).toBe(true);
    expect(a.authorRosterGrant).toBe(true); // the owner controls the roster
    expect(a.ownerOnlyContent).toBe(false); // not the retired owner-only dead-end
    expect(a.authorImmutable).toBe(true); // each post is author-owned
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
