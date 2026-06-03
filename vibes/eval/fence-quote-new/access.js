// quoteRequest docs: any signed-in user can create their own; only the owner can update status.
// Channels: all requests go to "requests" channel, granted to owner and the author.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to submit" };
  if (doc.type === "quoteRequest") {
    if (!oldDoc) {
      if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
      return {
        channels: ["requests"],
        grant: { users: { [doc.authorHandle]: ["requests"] } },
      };
    }
    if (!user.isOwner) throw { forbidden: "only sales team can update" };
    return { channels: ["requests"] };
  }
  return {};
}
