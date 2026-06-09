// Doc types:
//   recipe   — any signed-in member can post their own (authorHandle must match)
//   vote     — any signed-in member; one doc per (recipeId, voterHandle), counted by length
//   roast    — any signed-in member can request a roast for any recipe
//   pin      — only the club owner can create/update; marks the week's winner
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to join the club" };
  if (doc.type === "recipe" || doc.type === "vote" || doc.type === "roast") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return {};
  }
  if (doc.type === "pin") {
    if (!user.isOwner) throw { forbidden: "only the club leader can pin" };
    return {};
  }
  return {};
}
