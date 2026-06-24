// Whiteboard with owner-managed access. Notes and strokes share one board channel.
// Owner creates the board doc which grants public read; members (granted by owner)
// can write notes/strokes. Authors can edit/move/delete only their own items.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to use the board" };

  if (doc.type === "board") {
    ctx.requireRole("owner");
    return {
      channels: ["board"],
      grant: { public: ["board"], roles: { editor: ["board"] } },
    };
  }

  if (doc.type === "membership") {
    ctx.requireRole("owner");
    return {
      channels: ["admin:grants"],
      members: { editor: [doc.userHandle] },
      grant: { users: { [user.userHandle]: ["admin:grants"] } },
    };
  }

  if (doc.type === "note" || doc.type === "stroke") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess("board");
    return { channels: ["board"] };
  }

  throw { forbidden: "unknown document type" };
}
