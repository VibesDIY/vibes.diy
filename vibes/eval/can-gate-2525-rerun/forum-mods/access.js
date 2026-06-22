// Doc types:
//   moderator    — owner-only; grants the named user the "moderator" role.
//   post         — signed-in author writes; mods may edit/remove (oldDoc author preserved).
//   reply        — signed-in author writes; mods may edit/remove.
//   pin          — moderator-only; pins a post id (delete pin to unpin).
// All docs route to one public channel so anyone can read the forum.
export function forum(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" };

  if (doc.type === "moderator") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { members: { moderator: [doc.userHandle] } };
  }

  if (doc.type === "post" || doc.type === "reply") {
    const isMod = (() => {
      try {
        ctx.requireRole("moderator");
        return true;
      } catch {
        return false;
      }
    })();
    if (oldDoc) {
      // edit: original author OR a moderator
      if (oldDoc.authorHandle !== user.userHandle && !isMod) {
        throw { forbidden: "only the author or a moderator can edit" };
      }
    } else {
      // create: must stamp self as author
      if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    }
    return { channels: ["public"], grant: { public: ["public"] } };
  }

  if (doc.type === "pin") {
    ctx.requireRole("moderator");
    return { channels: ["public"], grant: { public: ["public"] } };
  }

  throw { forbidden: "unknown document type" };
}
