// Forum access rules:
// - "post" docs: any signed-in user creates their own; only the author OR a moderator OR owner may edit/delete.
//   Posts route to the public "forum" channel which is grant.public for read-only access.
// - "modGrant" docs (owner-only): grant "moderator" role to a userHandle. Routed to an admin channel
//   so it persists and the owner can read the roster back. The members{} assignment makes the
//   moderator role active everywhere.
// Moderators are detected via ctx.requireRole inside try/catch (it throws if not in role).
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" };

  if (doc.type === "modGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      channels: ["admin:mods"],
      members: { moderator: [doc.userHandle] },
      grant: { users: { [user.userHandle]: ["admin:mods"] } },
    };
  }

  if (doc.type === "post") {
    // Determine if user is a moderator (or owner — owner bypasses).
    let isMod = user.isOwner;
    if (!isMod) {
      try {
        ctx.requireRole("moderator");
        isMod = true;
      } catch (e) {}
    }
    if (oldDoc) {
      // Edit/delete: must be original author OR moderator/owner.
      if (oldDoc.authorHandle !== user.userHandle && !isMod) {
        throw { forbidden: "only author or moderator can edit" };
      }
      // Preserve original author on edits.
      if (doc.authorHandle !== oldDoc.authorHandle && !isMod) {
        throw { forbidden: "cannot reassign author" };
      }
    } else {
      // New post: author must be self.
      if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    }
    return { channels: ["forum"], grant: { public: ["forum"] } };
  }

  throw { forbidden: "unknown document type" };
}
