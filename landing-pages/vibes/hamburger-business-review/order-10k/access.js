// Filings are public-read so anyone with the link can browse the archive.
// Only authenticated users can file; only the author (or owner) can delete.
// One shared channel "filings" — every filing routes there, granted public.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to file" }
  if (doc.type !== "filing") throw { forbidden: "unknown document type" }
  if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
    throw { forbidden: "not author" }
  }
  if (!oldDoc && doc.authorHandle !== user.userHandle) {
    throw { forbidden: "author mismatch" }
  }
  return {
    channels: ["filings"],
    grant: { public: ["filings"] },
  }
}