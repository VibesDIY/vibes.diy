// chat database — owner creates channels and assigns roles; members post messages.
// Channel docs use _id "ch:<name>" for uniqueness, grant.public for read,
// and grant.roles so members/admins can write to that channel.
// Role grant docs (type "roleGrant") are owner-only; they expand members[role] -> userHandle.
// Messages are author-gated and require the writer be in the channel via requireAccess.
export function chat(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" }

  if (doc.type === "channel") {
    ctx.requireRole("owner")
    return {
      channels: [doc._id],
      grant: {
        public: [doc._id],
        roles: { admin: [doc._id], member: [doc._id] },
        users: { [user.userHandle]: [doc._id] },
      },
    }
  }

  if (doc.type === "roleGrant") {
    ctx.requireRole("owner")
    return {
      channels: ["admin:grants"],
      members: { [doc.role]: [doc.userHandle] },
      grant: { users: { [user.userHandle]: ["admin:grants"] } },
    }
  }

  if (doc.type === "message") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
    ctx.requireAccess(doc.channelId)
    return { channels: [doc.channelId] }
  }

  throw { forbidden: "unknown document type" }
}