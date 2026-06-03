// Decks and cards are owner-authored; everyone signed in reads them via default app permissions.
// Learned-status updates are tracked as separate "progress" docs keyed by user, so each viewer
// can mark their own progress without overwriting others.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "deck" || doc.type === "card") {
    if (!user.isOwner) throw { forbidden: "owner only" };
  }
  if (doc.type === "progress") {
    if (doc.userHandle !== user.userHandle) throw { forbidden: "not your progress" };
  }
  return {};
}
