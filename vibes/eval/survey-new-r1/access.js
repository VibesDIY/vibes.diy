// Survey app permissions:
// - response: anonymous-friendly submissions, write-once (no edits). Routed to "inbound" channel.
// - summary: only owner can publish. Public read.
// - The owner sees responses via channel grant; visitors only see summaries.
export function feedback(doc, oldDoc, user, ctx) {
  if (doc.type === "response") {
    if (oldDoc) throw { forbidden: "responses are write-once" };
    return { channels: ["inbound"], allowAnonymous: true };
  }
  if (doc.type === "summary") {
    if (!user?.isOwner) throw { forbidden: "owner only" };
    return { channels: ["public-summary"], grant: { public: ["public-summary"] } };
  }
  if (!user) throw { forbidden: "sign in" };
  return {};
}
