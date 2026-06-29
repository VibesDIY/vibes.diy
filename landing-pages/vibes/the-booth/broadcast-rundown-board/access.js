// Run-of-show: owner + anyone granted into the "rundown" channel can edit segments.
// Owner bootstraps access by creating accessGrant docs that add users to the rundown channel.
// Everyone else gets a read-only view (no channel access → no writes accepted).
export function runOfShow(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" }

  if (doc.type === "accessGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    return {
      channels: ["rundown"],
      grant: {
        public: ["rundown"],
        users: { [doc.userHandle]: ["rundown"] },
      },
    }
  }

  if (doc.type === "segment") {
    if (!user.isOwner) ctx.requireAccess("rundown")
    return { channels: ["rundown"] }
  }

  throw { forbidden: "unknown document type" }
}