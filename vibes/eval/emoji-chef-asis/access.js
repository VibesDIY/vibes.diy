// Recipes: any signed-in user can publish their own; authorHandle must match.
// Roasts: any signed-in user can submit a roast for any recipe (the AI is the critic, not the user).
// Anonymous users get read-only access — no write surfaces shown.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to cook" };
  if (doc.type === "recipe") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return {};
  }
  if (doc.type === "roast") {
    return {};
  }
  return {};
}
