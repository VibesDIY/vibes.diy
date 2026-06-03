// Permission model:
// - habit docs: only the owner can create/edit/archive. Public read so viewers see streaks.
// - checkin docs: only the owner can log check-ins. Public read so streak counters update live.
// - nudge docs: only the owner writes (after callAI generates the message). Public read.
// Everyone signed in can read; only the owner writes. Anonymous users can also read (default app-level public toggle).
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "habit" || doc.type === "checkin" || doc.type === "nudge") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  return {};
}
