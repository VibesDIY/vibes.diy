// Trivia game permissions:
// - rounds and questions: owner-only (host controls the game flow)
// - answers: any signed-in player, but only for themselves; tagged with authorHandle
// - everything is readable by all members so the live question and final scoreboard sync to everyone
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to play" };

  if (doc.type === "round" || doc.type === "question") {
    if (!user.isOwner) throw { forbidden: "host only" };
    return {};
  }

  if (doc.type === "answer") {
    if (doc.playerHandle !== user.userHandle) throw { forbidden: "not your answer" };
    if (oldDoc && oldDoc.playerHandle !== user.userHandle) throw { forbidden: "cannot edit others" };
    return {};
  }

  return {};
}
