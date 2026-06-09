// Lists and tasks are app-wide; anyone signed in can read.
// Only the owner creates lists. Anyone signed in can add tasks, but only
// the author (or owner) can edit/delete their own task. Completion toggle
// is allowed by any signed-in user so collaborators can check things off.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "list") {
    if (!user.isOwner) throw { forbidden: "owner manages lists" };
    return {};
  }

  if (doc.type === "task") {
    if (!oldDoc) {
      if (doc.authorHandle !== user.userHandle) throw { forbidden: "author mismatch" };
      return {};
    }
    // Update path: author or owner can change anything; others can only toggle `done`.
    const isAuthor = oldDoc.authorHandle === user.userHandle;
    if (isAuthor || user.isOwner) return {};
    const changedKeys = Object.keys({ ...doc, ...oldDoc }).filter((k) => doc[k] !== oldDoc[k] && k !== "_rev");
    if (changedKeys.length === 1 && changedKeys[0] === "done") return {};
    throw { forbidden: "only author can edit" };
  }

  return {};
}
