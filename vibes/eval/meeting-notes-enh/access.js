// Bullets: any signed-in user can write their own (authorHandle must match).
// Summaries: only the vibe owner (organizer) can publish.
// Anyone signed in can read everything — no channel routing needed.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to participate" };
  if (doc.type === "bullet") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "cannot edit others' bullets" };
    return {};
  }
  if (doc.type === "summary") {
    if (!user.isOwner) throw { forbidden: "organizer only" };
    return {};
  }
  return {};
}
