// Decks and cards live in the shared "flashsync" database.
// - Anyone signed in can create/edit decks and cards (group collaboration).
// - Authors are stamped via authorHandle; only the original author (or owner) can edit/delete.
// Private scores live in a separate per-user database "flashsync-scores" (no access function -> default app rules).
export function flashsync(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to edit shared decks" };
  if (doc.type === "deck" || doc.type === "card") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only the author or owner can edit" };
    }
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match signed-in user" };
    }
    return {};
  }
  return {};
}
