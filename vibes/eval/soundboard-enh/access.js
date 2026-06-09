// soundboard database:
// - sample docs: type "sample", status "pending" or "approved", with _files.clip audio attachment
// - any signed-in user can create pending samples and edit their own
// - only the producer (owner) can change status to approved or delete
export function soundboard(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to use the board" };
  if (doc.type !== "sample") throw { forbidden: "unknown doc type" };

  // creating a new sample
  if (!oldDoc) {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "wrong author" };
    if (doc.status !== "pending") throw { forbidden: "new samples must be pending" };
    return {};
  }

  // updates
  const statusChanged = doc.status !== oldDoc.status;
  if (statusChanged && !user.isOwner) throw { forbidden: "only producer can approve" };
  if (!user.isOwner && oldDoc.authorHandle !== user.userHandle) {
    throw { forbidden: "can only edit your own submissions" };
  }
  return {};
}
