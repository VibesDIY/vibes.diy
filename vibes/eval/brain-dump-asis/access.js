// Lists: owner-only creation, public read so all members see them.
// Tasks: any signed-in user can create, only author can edit/delete their own.
// Both go into the "tasks" channel which is publicly readable to members.
export function brainDump(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "list") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { channels: ["tasks"], grant: { public: ["tasks"] } };
  }

  if (doc.type === "task") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) {
      throw { forbidden: "not author" };
    }
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match signer" };
    }
    return { channels: ["tasks"] };
  }

  return {};
}
