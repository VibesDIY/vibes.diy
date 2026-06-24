// Habits and completions are owned by the vibe owner.
// - habit docs: only owner can create/edit/delete (ctx.requireRole("owner"))
// - completion docs: only owner can log completions
// - All docs routed to a public channel so granted viewers see read-only state.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "habit" || doc.type === "completion") {
    ctx.requireRole("owner");
    if (oldDoc && oldDoc.createdBy !== oldDoc.createdBy) throw { forbidden: "immutable" };
    return { channels: ["tracker"], grant: { public: ["tracker"] } };
  }
  throw { forbidden: "unknown document type" };
}
