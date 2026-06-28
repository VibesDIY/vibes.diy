// Single shared settings doc — only the owner edits it. Everyone reads it (public).
export function bouncingBox(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (doc._id === "box:settings") {
    ctx.requireRole("owner"); // owner auto-seeded into reserved `owner` role
    return { channels: ["box"], grant: { public: ["box"] } };
  }
  throw { forbidden: "unknown document" };
}
