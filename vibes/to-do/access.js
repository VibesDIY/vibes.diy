// Single owner-managed todo list. Owner creates/edits/deletes tasks.
// Everyone else gets read-only via grant.public.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" }
  if (doc.type === "task") {
    ctx.requireRole("owner")
    return { channels: ["tasks"], grant: { public: ["tasks"] } }
  }
  throw { forbidden: "unknown document type" }
}