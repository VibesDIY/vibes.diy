// One trip per app instance. Owner creates the trip + activities + packing items.
// All members can read (public). Collaborators with the 'planner' role can write.
// Grant the planner role to your collaborators via a roleGrant doc (owner-only).
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "trip") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      channels: ["trip"],
      grant: { public: ["trip"], roles: { planner: ["trip"] } },
    };
  }

  if (doc.type === "roleGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { members: { [doc.role]: [doc.userHandle] } };
  }

  if (doc.type === "activity" || doc.type === "packing") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    ctx.requireAccess("trip");
    return { channels: ["trip"] };
  }

  throw { forbidden: "unknown document type" };
}
