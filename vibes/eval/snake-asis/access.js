// Score docs are write-once per submission, owned by their author.
// Anyone signed in can submit; only the author handle on the doc matches the user.
// All scores are public-readable (no channel routing needed — single shared board).
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to play" };
  if (doc.type === "score") {
    if (oldDoc) throw { forbidden: "scores are write-once" };
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return {};
  }
  return {};
}
