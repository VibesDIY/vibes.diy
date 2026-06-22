// Open shared task board: any signed-in user can create tasks.
// Tasks live on a single public channel so everyone sees them.
// Only the author can edit or delete their own task.
export function tasks(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to use the task list" };
  if (doc.type === "task") {
    // On edit/delete, only the original author can mutate
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) {
      throw { forbidden: "only the author can edit this task" };
    }
    if (doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match signed-in user" };
    }
    return { channels: ["board"], grant: { public: ["board"] } };
  }
  throw { forbidden: "unknown document type" };
}
