// milestone: only the vibe owner (the team lead) can create or modify.
// update: any signed-in member can post; must be their own authorHandle.
// Deletions follow the same rules as writes.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "milestone") {
    if (!user.isOwner) throw { forbidden: "lead only" };
    return {};
  }
  if (doc.type === "update") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return {};
  }
  return {};
}
