// Document types:
//   - "post": authored content. Anyone signed in can create their own posts in the "forum" channel.
//   - "modGrant": owner-only doc that grants the "moderator" role to a userHandle.
//   - "modAction": pin/flag/remove actions on a post. Only moderators (or owner) can write these.
// All docs route to the "forum" channel, granted publicly so all members can read the feed.
export function forum(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" };

  if (doc.type === "modGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      channels: ["forum"],
      members: { moderator: [doc.userHandle] },
      grant: { public: ["forum"] },
    };
  }

  if (doc.type === "post") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    // editing: only the author can edit their own post (mods use modAction docs instead)
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: ["forum"], grant: { public: ["forum"] } };
  }

  if (doc.type === "modAction") {
    if (!user.isOwner) ctx.requireRole("moderator");
    if (doc.byHandle !== user.userHandle) throw { forbidden: "byHandle must match signer" };
    return { channels: ["forum"], grant: { public: ["forum"] } };
  }

  throw { forbidden: "unknown document type" };
}
