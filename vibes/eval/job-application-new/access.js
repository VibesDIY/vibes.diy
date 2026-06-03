// Candidates (members) can submit applications — write-once, no edits after creation.
// Reviewers (editors) can read everything. Only the hiring team can delete.
// allowAnonymous lets candidates apply without signing in if the app owner opens it up.
export function careerpost(doc, oldDoc, user) {
  if (doc.type === "application") {
    if (oldDoc) throw { forbidden: "applications cannot be edited after submission" };
    return { allowAnonymous: true };
  }
  if (!user) throw { forbidden: "sign in" };
  return {};
}
