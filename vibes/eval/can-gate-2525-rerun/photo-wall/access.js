// snapwall access:
// - channel: owner-only; grant.public so everyone can read. Open board — any
//   signed-in user posts. Do NOT gate posts on ctx.requireAccess (public is
//   read-only and never satisfies it).
// - post: author-only write; routed to its channel.
// - message: author-only write; routed to its channel.
// - image (ImgGen standalone docs): allow so the AI vibe sketch works.
export function snapwall(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "channel") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { channels: [doc._id], grant: { public: [doc._id] } };
  }

  if (doc.type === "post") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: [doc.channelId] };
  }

  if (doc.type === "message") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: [doc.channelId] };
  }

  if (doc.type === "image") {
    return { channels: ["public"], grant: { public: ["public"] } };
  }

  throw { forbidden: "unknown document type" };
}
