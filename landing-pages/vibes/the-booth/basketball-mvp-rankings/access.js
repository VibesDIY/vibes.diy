// Document types:
//   player    — created by signed-in users, public-read in "league" channel
//   vote      — one per (user, week), only the voter can write
//   weekMeta  — singleton tracking current week, owner-only writes
// All docs route to the "league" channel which is public-read for all members,
// so non-owners get a read-only view automatically.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in required" }

  if (doc.type === "weekMeta") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    return { channels: ["league"], grant: { public: ["league"] } }
  }

  if (doc.type === "player") {
    if (oldDoc && oldDoc.createdBy !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only creator or owner can edit" }
    }
    if (doc.createdBy !== user.userHandle) throw { forbidden: "createdBy must match" }
    return { channels: ["league"], grant: { public: ["league"] } }
  }

  if (doc.type === "vote") {
    if (doc.voterHandle !== user.userHandle) throw { forbidden: "not your vote" }
    return { channels: ["league"], grant: { public: ["league"] } }
  }

  throw { forbidden: "unknown document type" }
}