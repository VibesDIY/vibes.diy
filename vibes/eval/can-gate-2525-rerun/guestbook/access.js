// Public guestbook: anyone (signed in or not) may sign with name + message.
// allowAnonymous: true is required — without it, the runtime rejects null-user
// writes even though we don't throw. Entries route to a single public channel
// with grant.public so everyone can read them back.
export function guestbook(doc, oldDoc, user, ctx) {
  if (doc.type === "entry") {
    if (oldDoc) throw { forbidden: "entries are write-once" };
    return { channels: ["public"], grant: { public: ["public"] }, allowAnonymous: true };
  }
  throw { forbidden: "unknown document type" };
}
