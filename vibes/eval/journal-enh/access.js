// Journal entries live in two channels:
//   - "private": only the owner has access (granted via grant.users)
//   - "shared":  publicly readable by anyone (grant.public) when owner marks shared:true
// Only the owner can write entries. Non-owners cannot write anything.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "entry") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    const channel = doc.shared ? "shared" : "private";
    return {
      channels: [channel],
      grant: {
        users: { [user.userHandle]: ["private", "shared"] },
        public: ["shared"],
      },
    };
  }
  return {};
}
