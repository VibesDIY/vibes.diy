// Dumps are owned by their author. Private dumps stay in no channel (author-only via createdBy).
// Shared dumps get routed to a "shared" channel with public read for all members.
// Only the author can edit/delete their own dumps. Only the owner can flip to shared.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "dump") {
    if (oldDoc && oldDoc.createdBy !== user.userHandle) throw { forbidden: "not author" };
    if (!oldDoc && doc.createdBy !== user.userHandle) throw { forbidden: "author mismatch" };
    if (doc.shared) {
      if (!user.isOwner) throw { forbidden: "only owner can share" };
      return { channels: ["shared"], grant: { public: ["shared"] } };
    }
    return {};
  }
  return {};
}
