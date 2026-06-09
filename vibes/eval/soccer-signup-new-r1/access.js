// games: only the coach (owner) can create/edit/delete game documents
// signups: parents can only create/edit/delete their own signup, identified by authorHandle
// the coach (owner) can override any signup as well
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to participate" };

  if (doc.type === "game") {
    if (!user.isOwner) throw { forbidden: "only the coach can edit the schedule" };
    return {};
  }

  if (doc.type === "signup") {
    if (user.isOwner) return {};
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "you can only edit your own sign-up" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not your sign-up" };
    return {};
  }

  return {};
}
