// Lore cards live in a shared archive channel anyone can read.
// Only authenticated users (curators) can write or delete cards.
// The owner gates curator access at the app membership level.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to curate" }
  if (doc.type === "loreCard") {
    if (oldDoc && oldDoc.createdBy !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only the author or owner can edit" }
    }
    return { channels: ["vault"], grant: { public: ["vault"] } }
  }
  throw { forbidden: "unknown document type" }
}