// A blog/publication: the OWNER controls the author roster; each author owns their own
// posts (only they edit them, and they moderate the comments inside their post); everyone reads.
// Owner-only-publishing is a dead end — the right model lets the owner approve authors, and once
// approved each post acts like that author's own object graph.
// - "author": only the owner approves authors (the ONE legitimate use of requireRole("owner")),
//   granting that user into the blog:authors channel. The owner is granted in via the owner role,
//   so the owner can publish without a separate self-grant.
// - "post": you must be an approved author (channel membership) to publish; the post is author-owned.
// - "comment": author-owned, but the post's author may moderate the comments on their own post.
// - Reads are public via grant.public.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  // The owner approves an author — the only place requireRole("owner") belongs (it gates the
  // roster, never the content). Granting the owner role into the channel lets the owner publish too.
  if (doc.type === "author") {
    ctx.requireRole("owner");
    return {
      channels: ["blog:authors"],
      grant: { users: { [doc.authorHandle]: ["blog:authors"] }, roles: { owner: ["blog:authors"] } },
    };
  }

  // A post: you must be an approved author (channel membership), and it is your own object.
  if (doc.type === "post") {
    ctx.requireAccess("blog:authors");
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "author is you" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "your own post" };
    return { channels: ["blog"], grant: { public: ["blog"] }, allowAnonymous: true };
  }

  // A comment: anyone signed in may comment (author-owned); the post's author moderates their post.
  if (doc.type === "comment") {
    const mine = doc.authorHandle === user.userHandle;
    const iModerate = doc.postAuthorHandle === user.userHandle;
    if (oldDoc ? !(mine || iModerate) : !mine) throw { forbidden: "your comment, or your post to moderate" };
    return { channels: ["blog"], grant: { public: ["blog"] } };
  }

  throw { forbidden: "unknown document type" };
}
