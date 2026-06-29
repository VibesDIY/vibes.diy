// Couple verdict docs: any signed-in user can save their own; everyone reads them.
// authorHandle is stamped at write time and validated server-side.
// One shared public channel "verdicts" so all viewers see the same gallery.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to save a verdict" }
  if (doc.type === "verdict") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not original author" }
    return {
      channels: ["verdicts"],
      grant: { public: ["verdicts"] },
    }
  }
  throw { forbidden: "unknown document type" }
}