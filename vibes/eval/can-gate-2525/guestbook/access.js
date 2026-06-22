// Public guestbook: any authenticated user can sign, everyone reads.
// Each entry routes to the "public" channel; granted publicly so all visitors see it.
// Author handle is stamped at write time and validated server-side.
export function guestbook(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to leave a message" };
  if (doc.type === "entry") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "cannot edit others" };
    return { channels: ["public"], grant: { public: ["public"] } };
  }
  throw { forbidden: "unknown document type" };
}
