// Portraits are world-readable (public channel) but only signed-in users can post.
// Each portrait must be stamped with the author's handle — the server rejects spoofing.
// Portraits are immutable once posted (no edits, no deletes by non-owners).
export function dreamJobs(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to post a portrait" };
  if (doc.type === "portrait") {
    if (oldDoc) throw { forbidden: "portraits are write-once" };
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: ["wall"], grant: { public: ["wall"] } };
  }
  return {};
}
