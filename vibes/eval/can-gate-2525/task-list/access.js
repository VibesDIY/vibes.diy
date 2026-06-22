// Shared task list: one public channel "tasks".
// Anyone signed in can create tasks (stamped with their authorHandle).
// Only the original author can edit or delete their task.
// Owner grants public read access to the tasks channel.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to use the task list" }
  if (doc.type !== "task") throw { forbidden: "unknown document type" }
  if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
    throw { forbidden: "only the author can edit" }
  }
  if (!oldDoc && doc.authorHandle !== user.userHandle) {
    throw { forbidden: "authorHandle must match you" }
  }
  return {
    channels: ["tasks"],
    grant: { public: ["tasks"] },
  }
}