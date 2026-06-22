// Two doc types:
//   - channel: owner-only; creates a public channel anyone can read & post in
//   - message: any signed-in user can post if they have access to the channel
export function board(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to use the board" }

  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "only the owner can create channels" }
    return { channels: [doc._id], grant: { public: [doc._id] } }
  }

  if (doc.type === "message") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
    ctx.requireAccess(doc.channelId)
    return { channels: [doc.channelId] }
  }

  throw { forbidden: "unknown document type" }
}