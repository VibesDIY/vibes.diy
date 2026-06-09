// Requests are routed to the "requests" channel.
// allowAnonymous: true lets visitors submit without signing in.
// Only the owner has read access to the channel (no grant.public),
// so visitors can write but cannot read others' submissions.
// The owner can read everything by virtue of being owner.
export default function (doc, oldDoc, user, ctx) {
  if (doc.type === "request") {
    if (oldDoc && (!user || !user.isOwner)) throw { forbidden: "owner only edits" };
    return { channels: ["requests"], allowAnonymous: true };
  }
  if (!user) throw { forbidden: "sign in" };
  return {};
}
