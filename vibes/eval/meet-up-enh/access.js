// availabilityVault DB: three doc types govern the scheduling protocol.
// - "submission" (private channel per user): only the author can read/write their windows.
//   Channel is "sub:<userHandle>" so each agent's windows live in their own isolated channel.
//   Owner is granted read access to ALL submission channels via grant.users on each doc.
// - "confirmed" (public read): the final locked time, written only by owner, readable by all members.
// - Only signed-in users can submit; owner is the sole organizer.
export function availabilityVault(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" };

  if (doc.type === "submission") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "agents submit only their own windows" };
    if (oldDoc && oldDoc.authorHandle !== doc.authorHandle) throw { forbidden: "author immutable" };
    const channel = "sub:" + user.userHandle;
    return {
      channels: [channel],
      grant: { users: { [user.userHandle]: [channel] } },
      // owner read access is automatic — owner sees all channels
    };
  }

  if (doc.type === "confirmed") {
    if (!user.isOwner) throw { forbidden: "only the organizer can confirm" };
    return {
      channels: ["confirmed"],
      grant: { public: ["confirmed"] },
    };
  }

  return {};
}
