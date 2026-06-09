// Goals and milestones are public-read within the app.
// Anyone signed in can create goals; only the goal creator can edit/check milestones on their goals.
// Milestones reference their parent goal via goalId.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to play" };
  if (doc.type === "goal") {
    if (oldDoc && oldDoc.createdBy !== user.userHandle) throw { forbidden: "not your quest" };
    if (!oldDoc && doc.createdBy !== user.userHandle) throw { forbidden: "wrong author" };
    return {};
  }
  if (doc.type === "milestone") {
    if (oldDoc && oldDoc.createdBy !== user.userHandle) throw { forbidden: "not your milestone" };
    if (!oldDoc && doc.createdBy !== user.userHandle) throw { forbidden: "wrong author" };
    return {};
  }
  return {};
}
