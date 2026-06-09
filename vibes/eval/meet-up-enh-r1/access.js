// slotSync database:
// - "slot" docs: each participant's availability window. Author-only write.
//   Routed to channel "submissions" — only the organizer is granted this channel,
//   so participants cannot read each other's slots. Authors can see their own
//   because they own the doc (creator always reads their own writes).
// - "suggestion" docs: AI-picked best time, owner-only write, public read so
//   everyone eventually sees the final pick if the organizer shares it.
export function slotSync(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "slot") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return {
      channels: ["submissions"],
      grant: { roles: { organizer: ["submissions"] } },
      members: user.isOwner ? { organizer: [user.userHandle] } : {},
    };
  }

  if (doc.type === "suggestion") {
    if (!user.isOwner) throw { forbidden: "organizer only" };
    return { channels: ["picks"], grant: { public: ["picks"] } };
  }

  return {};
}
