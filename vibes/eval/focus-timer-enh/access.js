// Pomodoro sessions are written only by the owning user (authorHandle must match).
// All authenticated users can read everyone's sessions — that's the team board.
// We don't use channels: the whole team shares one stream of session docs.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "session") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not your session" };
    if (oldDoc && oldDoc.authorHandle !== doc.authorHandle) throw { forbidden: "cannot change author" };
  }
  return {};
}
