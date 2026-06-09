// taskBoard database — three doc types:
//   "column" — only the owner (project lead) can create or archive
//   "card"   — any signed-in user can create; only the author can edit/move their own card
// Cards reference columnId; we route all docs to the shared "board" channel so everyone sees them.
export function taskBoard(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to use the board" };

  if (doc.type === "column") {
    if (!user.isOwner) throw { forbidden: "only the project lead manages columns" };
    return { channels: ["board"], grant: { public: ["board"] } };
  }

  if (doc.type === "card") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) {
      throw { forbidden: "only the card author can edit" };
    }
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match signed-in user" };
    }
    return { channels: ["board"] };
  }

  return {};
}
