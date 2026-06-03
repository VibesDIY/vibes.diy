// submission docs: each routed to a per-user channel keyed by author handle.
//   - The author gets access via grant.users (sees their own).
//   - The owner gets access via grant.roles → organizer (sees all submissions).
// confirmed docs: public read so everyone sees the final time.
// Only the owner can write confirmed docs (organizer role is owner-only here).
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "submission") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    const ch = "sub:" + doc.authorHandle;
    return {
      channels: [ch],
      grant: {
        users: { [doc.authorHandle]: [ch] },
        roles: { organizer: [ch] },
      },
      members: user.isOwner ? { organizer: [user.userHandle] } : {},
    };
  }

  if (doc.type === "confirmed") {
    if (!user.isOwner) throw { forbidden: "organizer only" };
    return { channels: ["confirmed"], grant: { public: ["confirmed"] } };
  }

  return {};
}
