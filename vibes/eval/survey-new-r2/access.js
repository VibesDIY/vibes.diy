// Responses: anyone (even anonymous) can submit one — they go into the "responses" channel,
// which only the owner can read. Visitors never see other people's answers.
// Summary: only the owner can write. Published summaries get grant.public so all members read live.
export default function (doc, oldDoc, user, ctx) {
  if (doc.type === "response") {
    if (oldDoc) throw { forbidden: "responses are write-once" };
    return { channels: ["responses"], allowAnonymous: true };
  }
  if (doc.type === "summary") {
    if (!user || !user.isOwner) throw { forbidden: "owner only" };
    const grants = { channels: ["summary"] };
    if (doc.published) grants.grant = { public: ["summary"] };
    return grants;
  }
  if (!user) throw { forbidden: "sign in" };
  return {};
}
