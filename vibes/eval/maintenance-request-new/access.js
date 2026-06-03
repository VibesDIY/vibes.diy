// Tenants submit requests stamped with their handle (channel = their handle).
// Only the author can edit description/unit. Owner (manager) can update status on any.
// Each request is routed to a per-tenant channel, granted to that tenant only.
// The manager is the app owner — owner bypasses channel checks automatically.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to submit a maintenance request" };

  if (doc.type === "request") {
    // Authors stamp their own handle; can't impersonate
    if (!oldDoc) {
      if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    } else {
      if (oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
        throw { forbidden: "not author" };
      }
      // Non-owners can't change status; only manager can
      if (!user.isOwner && doc.status !== oldDoc.status) {
        throw { forbidden: "only manager can change status" };
      }
      // Author can't change their own handle
      if (doc.authorHandle !== oldDoc.authorHandle) {
        throw { forbidden: "authorHandle immutable" };
      }
    }
    // Route to per-tenant channel; grant access to that tenant
    return {
      channels: [doc.authorHandle],
      grant: { users: { [doc.authorHandle]: [doc.authorHandle] } },
    };
  }

  return {};
}
