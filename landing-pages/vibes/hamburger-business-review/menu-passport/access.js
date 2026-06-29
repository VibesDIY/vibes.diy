// menuItem: shared catalog, owner-only writes, everyone reads via public channel.
// stamp / quizAttempt: per-user private — author writes, only author reads via their user channel.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" }

  if (doc.type === "menuItem") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    return { channels: ["catalog"], grant: { public: ["catalog"] } }
  }

  if (doc.type === "stamp" || doc.type === "quizAttempt") {
    const handleField = doc.type === "stamp" ? "stampedBy" : "attemptedBy"
    if (doc[handleField] !== user.userHandle) throw { forbidden: "not author" }
    const mine = `user:${user.userHandle}`
    return { channels: [mine, "catalog"], grant: { users: { [user.userHandle]: [mine, "catalog"] } } }
  }

  throw { forbidden: "unknown document type" }
}