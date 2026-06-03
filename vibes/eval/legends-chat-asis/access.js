// Only authenticated users may write messages. Anyone (including anonymous viewers)
// can read the dialogue because no channel routing is applied — the database is
// readable by all members of the vibe via the runtime's default sharing.
// The author handle on each user message must match the signed-in user.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to speak" };
  if (doc.role === "user" && doc.authorHandle !== user.userHandle) {
    throw { forbidden: "not author" };
  }
  return {};
}
