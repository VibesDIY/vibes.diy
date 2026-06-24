// Blog posts: only the owner publishes; everyone reads.
// - "post" docs route to a public channel so anyone (signed in or not) can read.
// - Only the vibe owner may create/edit/delete posts (ctx.requireRole("owner")).
// - Posts are public-read via grant.public; no per-user channel grants needed.
export default function (doc, oldDoc, user, ctx) {
  if (doc.type === "post") {
    ctx.requireRole("owner");
    if (oldDoc && oldDoc.type !== "post") throw { forbidden: "type is immutable" };
    return { channels: ["blog"], grant: { public: ["blog"] }, allowAnonymous: true };
  }
  throw { forbidden: "unknown document type" };
}
