// Permission model:
// - "question" docs: only the vibe owner can create. Everyone reads via grant.public on "trivia" channel.
// - "answer" docs: any signed-in user can submit, but only as themselves (authorHandle must match).
// - Owner creates a singleton "config" doc to grant public read on the "trivia" channel.
export function trivia(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to play" };

  if (doc.type === "config") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { channels: ["trivia"], grant: { public: ["trivia"] } };
  }

  if (doc.type === "question") {
    if (!user.isOwner) throw { forbidden: "host only" };
    return { channels: ["trivia"] };
  }

  if (doc.type === "answer") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess("trivia");
    return { channels: ["trivia"] };
  }

  return {};
}
