// Owner-only channel creation; channels are public-read (open board pattern).
// Any signed-in user posts — we check the author and route by channelId, but
// we do NOT call ctx.requireAccess on the channel (grant.public is read-only
// and never satisfies requireAccess, so gating posts on it would block every
// non-owner from posting).
export function signalBoard(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to post" };

  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "only the team owner can create channels" };
    if (oldDoc && oldDoc.createdBy !== user.userHandle) throw { forbidden: "not creator" };
    return { channels: [doc._id], grant: { public: [doc._id] } };
  }

  if (doc.type === "message") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: [doc.channelId] };
  }

  throw { forbidden: "unknown document type" };
}
