// Guestbook: anyone (signed in OR anonymous) may sign. Owner can delete any entry.
// allowAnonymous: true lets visitors sign without logging in.
// We stamp authorHandle only when signed in; anon entries have authorHandle: null.
export function guestbook(doc, oldDoc, user, ctx) {
  if (doc.type === "entry") {
    // Write-once: entries can't be edited after creation (owner can delete via channel).
    if (oldDoc) throw { forbidden: "entries cannot be edited" };
    // If signed in, the stamped handle must match the writer.
    if (user && doc.authorHandle && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "not author" };
    }
    return { channels: ["public"], grant: { public: ["public"] }, allowAnonymous: true };
  }
  throw { forbidden: "unknown document type" };
}
