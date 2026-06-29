// Glossary terms are shared across the whole crew via the public "lexicon" channel.
// Anyone signed in can create a term or cast an upvote.
// Edits to a term are restricted to the original author (or the vibe owner via runtime).
// Upvotes are individual docs (one per user per term) so concurrent votes never conflict
// and a user can "unvote" by deleting their own upvote doc.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to contribute" }

  if (doc.type === "term") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) {
      throw { forbidden: "only the author can edit this term" }
    }
    if (doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match signed-in user" }
    }
    return { channels: ["lexicon"], grant: { public: ["lexicon"] } }
  }

  if (doc.type === "upvote") {
    if (doc.voterHandle !== user.userHandle) {
      throw { forbidden: "voterHandle must match signed-in user" }
    }
    return { channels: ["lexicon"] }
  }

  throw { forbidden: "unknown document type" }
}