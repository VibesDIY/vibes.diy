// hearthJournal access: signed-in users write their own entries; everyone signed in can read the shared feed.
// authorHandle is immutable and must match the writer. Owner can delete via UI (database.del still requires they pass author check unless owner-bypass is needed — here we require author for writes, and the owner-only delete is enforced UI-side).
export function hearthJournal(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to journal" };
  if (doc.type === "entry") {
    if (doc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "not author" };
    }
    if (oldDoc && oldDoc.authorHandle !== doc.authorHandle) {
      throw { forbidden: "authorHandle is immutable" };
    }
  }
  return {};
}
