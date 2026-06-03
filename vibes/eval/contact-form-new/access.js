// Contact requests are write-once and submittable by anyone (including anonymous visitors).
// Only the owner can read them (no public/role grants on the channel).
// Only the owner can update status fields on existing requests.
export default function (doc, oldDoc, user, ctx) {
  if (doc.type === "request") {
    if (!oldDoc) {
      // Anyone can create a new request — no auth required.
      return { channels: ["requests"], allowAnonymous: true };
    }
    // Updates (status changes) — owner only.
    if (!user || !user.isOwner) throw { forbidden: "owner only" };
    return { channels: ["requests"] };
  }
  if (!user) throw { forbidden: "sign in" };
  return {};
}
