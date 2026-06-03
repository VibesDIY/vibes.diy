// Only the vibe owner can submit scores (they're the only player).
// Scores are public-readable so spectators see the live leaderboard.
// Score docs go to the "scores" channel which is granted public access.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "score") {
    if (!user.isOwner) throw { forbidden: "owner only — spectators cannot submit scores" };
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc) throw { forbidden: "scores are write-once" };
    return { channels: ["scores"], grant: { public: ["scores"] } };
  }
  return {};
}
