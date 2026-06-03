// Council of Echoes permissions.
// - threads: only the author can create/update; everyone authenticated can read (public channel "wall").
// - messages: only the thread's original author can write replies; channel-scoped to "wall" so all members read.
// Anonymous users cannot write anything. Reads are open to any signed-in member.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to join the council" };

  if (doc.type === "thread") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not your thread" };
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "author mismatch" };
    return { channels: ["wall"], grant: { public: ["wall"] } };
  }

  if (doc.type === "message") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: ["wall"] };
  }

  return {};
}
