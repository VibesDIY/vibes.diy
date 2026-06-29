// Locations and annotations are publicly readable communal knowledge.
// Any signed-in user can create locations and add annotations.
// Only the original author can edit their own location or annotation.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to contribute to the codex" }

  if (doc.type === "location") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only the original chronicler may amend" }
    }
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "author handle must match" }
    }
    return { channels: ["codex"], grant: { public: ["codex"] } }
  }

  if (doc.type === "annotation") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only the original scribe may amend" }
    }
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "author handle must match" }
    }
    return { channels: ["codex"], grant: { public: ["codex"] } }
  }

  throw { forbidden: "unknown document type" }
}