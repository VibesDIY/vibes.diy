// FocusStack permissions:
// - "timer" docs: only the owner can create/edit/delete (controls the stack)
// - "session" docs: written by the owner when a work interval completes (stats record)
// - "insight" docs: AI coach output, owner-written, readable by all members
// Everyone signed in can read everything (public stats dashboard).
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "timer" || doc.type === "session" || doc.type === "insight") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  return {};
}
