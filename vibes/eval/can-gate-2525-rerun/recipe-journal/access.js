// Recipe journal: owner-only authoring. Recipes live in one public-read channel
// so non-owners can browse but only the owner can create/edit/delete.
export function recipes(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "recipe") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { channels: ["journal"], grant: { public: ["journal"] } };
  }
  throw { forbidden: "unknown document type" };
}
