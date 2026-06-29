// Single shared game document keyed by _id "game".
// Only the owner can write the game state (scores, fouls, clock, names, quarter).
// All members can read — this makes the scoreboard a live spectator view.
export function scoreboard(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" }
  if (doc.type === "game") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    return {
      channels: ["game"],
      grant: { public: ["game"] },
    }
  }
  throw { forbidden: "unknown document type" }
}