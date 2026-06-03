// Photo board access rules:
// - Owner creates albums; album docs grant public read so all members see them.
// - Any signed-in member can upload photos; photos are stamped with authorHandle.
// - Only the owner can delete (enforced by runtime via isOwner, not here — this fn validates writes).
// - Photos route to the album's channel so album filtering works server-side.
export function tripBoard(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to use the board" };

  if (doc.type === "album") {
    if (!user.isOwner) throw { forbidden: "only the owner can create albums" };
    return { channels: [doc._id], grant: { public: [doc._id] } };
  }

  if (doc.type === "photo") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only author or owner can edit" };
    }
    ctx.requireAccess(doc.albumId);
    return { channels: [doc.albumId] };
  }

  return {};
}
