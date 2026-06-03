// Bullets and summaries are both owner-only writes.
// Read access is open to all members (default app-level public toggle).
// No channels needed — single shared meeting room per database.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "bullet" || doc.type === "summary") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  return {};
}
