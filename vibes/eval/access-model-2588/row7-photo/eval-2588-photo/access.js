// OPEN wall: any signed-in user posts and comments. grant.public makes posts
// readable by everyone; we check authorship (not requireAccess, since public
// is read-only and would block writes).
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to participate" };
  if (doc.type === "post") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: ["wall"], grant: { public: ["wall"] } };
  }
  if (doc.type === "comment") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: ["wall"], grant: { public: ["wall"] } };
  }
  if (doc.type === "image") {
    return { channels: ["wall"], grant: { public: ["wall"] } };
  }
  throw { forbidden: "unknown document type" };
}
