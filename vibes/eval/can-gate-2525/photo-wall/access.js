// Posts and comments live on a single public channel "wall" so the whole community sees them.
// Only the owner can create the channel doc. Authenticated users can post/comment as themselves.
export function snapshotWall(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" }

  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    return { channels: [doc._id], grant: { public: [doc._id] } }
  }

  if (doc.type === "post" || doc.type === "comment" || doc.type === "image") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
    ctx.requireAccess("ch:wall")
    return { channels: ["ch:wall"] }
  }

  throw { forbidden: "unknown document type" }
}