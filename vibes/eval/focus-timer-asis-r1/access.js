// Timers, ticks, and tips all live in the "forge" database.
// Only the owner can create/update/delete timers and tick them forward.
// Anyone signed in can read; tips are written by the owner when work phases end.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to view" };
  if (doc.type === "timer" || doc.type === "tip") {
    if (!user.isOwner) throw { forbidden: "owner only" };
  }
  return {};
}
