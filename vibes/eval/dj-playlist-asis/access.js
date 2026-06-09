// Single doc type "mixtape" — only the owner can create playlists.
// All mixtapes are public-readable so any visitor sees the live feed.
export function moodMixtape(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "mixtape") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  return {};
}
