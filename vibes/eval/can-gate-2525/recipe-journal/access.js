// Recipes are written only by the vibe owner; everyone (including anonymous
// visitors) can read them. The owner's recipes live on a public channel so
// the journal browses freely while writes stay locked to the author.
export function recipeJournal(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to save" };
  if (!user.isOwner) throw { forbidden: "only the journal owner can save recipes" };

  if (doc.type === "recipe") {
    if (oldDoc && oldDoc.createdBy !== user.userHandle) {
      throw { forbidden: "not the original author" };
    }
    return {
      channels: ["journal"],
      grant: { public: ["journal"] },
    };
  }
  throw { forbidden: "unknown document type" };
}
