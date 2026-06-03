// Single doc type: "act" — anyone signed in can create acts, only the author can edit/delete their own.
// Stars are stored as a separate "star" doc per (user, act) so multiple users can independently favorite the same act.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to edit the lineup" };
  if (doc.type === "act") {
    if (oldDoc && oldDoc.createdBy !== user.userHandle) throw { forbidden: "only the author can edit this act" };
    return {};
  }
  if (doc.type === "star") {
    if (doc.userHandle !== user.userHandle) throw { forbidden: "stars are per-user" };
    return {};
  }
  return {};
}
