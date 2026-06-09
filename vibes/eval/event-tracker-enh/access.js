// Acts are written by crew only (role: "crew") and stored on a public "lineup" channel
// so any visitor — signed in or not — can read them.
// Stars are private per-user: each star doc is routed to a per-user channel so only
// that user sees their own favorites. Anyone signed in can star.
// The vibe owner is implicitly crew (isOwner). Owner can grant the crew role to others
// by creating roleGrant docs.
export function festival(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  // Owner grants crew role to teammates
  if (doc.type === "roleGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { members: { crew: [doc.userHandle] } };
  }

  // Acts: crew-only writes, public read on "lineup" channel
  if (doc.type === "act") {
    if (!user.isOwner) ctx.requireRole("crew");
    return {
      channels: ["lineup"],
      grant: { public: ["lineup"] },
    };
  }

  // Stars: private to the author, routed to per-user channel
  if (doc.type === "star") {
    if (doc.userHandle !== user.userHandle) throw { forbidden: "not author" };
    const ch = "star:" + user.userHandle;
    return {
      channels: [ch],
      grant: { users: { [user.userHandle]: [ch] } },
    };
  }

  return {};
}
