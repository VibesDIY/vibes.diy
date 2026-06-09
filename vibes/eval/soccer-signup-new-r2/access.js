// Two doc types:
// - "game": only the owner (coach) can create/edit/delete. Public read for everyone.
// - "signup": parents create their own (authorHandle must match). Coach can edit/delete anyone's.
//   A signup has { gameId, authorHandle, name }.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "game") {
    if (!user.isOwner) throw { forbidden: "coach only" };
    return {};
  }

  if (doc.type === "signup") {
    // Coach can write/edit/delete any signup
    if (user.isOwner) return {};
    // Otherwise, must be the author and can't change authorship
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not your signup" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not your signup" };
    return {};
  }

  return {};
}
