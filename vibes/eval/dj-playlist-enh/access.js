// mood-requests: any signed-in guest can submit; author stamped from userHandle
// suggestions: written by the same author (the AI result is saved client-side after callAI)
// queue items: only the owner (DJ) can write/delete
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to join the party" };

  if (doc.type === "mood" || doc.type === "suggestion") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return {};
  }

  if (doc.type === "queueItem") {
    if (!user.isOwner) throw { forbidden: "DJ only" };
    return {};
  }

  return {};
}
