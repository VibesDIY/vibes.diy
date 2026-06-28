// Each signed-in visitor manages their own private tasks.
// Tasks route to a per-user channel `user:<handle>` so each user reads only their own.
// Author check + oldDoc author check ensures no one can overwrite someone else's task.
export function tasks(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to manage tasks" }
  if (doc.type === "task") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" }
    const mine = `user:${user.userHandle}`
    return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } }
  }
  throw { forbidden: "unknown document type" }
}