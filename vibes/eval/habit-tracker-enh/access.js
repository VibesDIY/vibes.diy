// Permission model:
// - habit: a user's habit definition. Only the author can create/edit; read is public to the group.
// - checkin: a daily check-off. Only the author can write; everyone reads (so streaks are visible).
// - cheer: encouragement on someone else's check-in. Any signed-in member can write their own cheer.
// No channels — this is one shared group. Sign-in is required for all writes.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to participate" };

  if (doc.type === "habit") {
    if (doc.ownerHandle !== user.userHandle) throw { forbidden: "habits belong to their owner" };
    if (oldDoc && oldDoc.ownerHandle !== user.userHandle) throw { forbidden: "cannot take over a habit" };
    return {};
  }

  if (doc.type === "checkin") {
    if (doc.ownerHandle !== user.userHandle) throw { forbidden: "only the owner can check in" };
    if (oldDoc && oldDoc.ownerHandle !== user.userHandle) throw { forbidden: "cannot edit another's check-in" };
    return {};
  }

  if (doc.type === "cheer") {
    if (doc.fromHandle !== user.userHandle) throw { forbidden: "cheers must be signed by sender" };
    return {};
  }

  return {};
}
