// Permission model:
// - bookmark: any signed-in user can create their own; only the author can edit.
//   Published to public channel "library" so everyone sees the feed.
// - collection: only curators can create/edit. Public-readable via "library".
//   The owner has implicit curator powers via isOwner.
// - roleGrant: only the owner can mint curator roles (doc type used to add members to "curator").
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "roleGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { members: { [doc.role]: [doc.userHandle] } };
  }

  if (doc.type === "bookmark") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: ["library"], grant: { public: ["library"] } };
  }

  if (doc.type === "collection") {
    if (!user.isOwner) ctx.requireRole("curator");
    return { channels: ["library"], grant: { public: ["library"], roles: { curator: ["library"] } } };
  }

  return {};
}
