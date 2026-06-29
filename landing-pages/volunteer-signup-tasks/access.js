// Permission model:
// - accessRequest: anyone signed in submits one for themselves. Channel "requests" granted to public so owner sees them.
//   Owner edits status (approve/reject). When approved, owner grants the user "volunteers" role membership.
// - task: only owner creates/edits. Public channel "tasks" so all members can read.
// - signup: approved volunteers (in "volunteers" role) create signups on tasks. Author-only writes.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to participate" }

  if (doc.type === "accessRequest") {
    if (!oldDoc) {
      if (doc.userHandle !== user.userHandle) throw { forbidden: "can only request for yourself" }
      return { channels: ["requests"], grant: { public: ["requests"] } }
    }
    if (!user.isOwner) throw { forbidden: "only owner can update requests" }
    return { channels: ["requests"], grant: { public: ["requests"] } }
  }

  if (doc.type === "roleGrant") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    return { members: { volunteers: [doc.userHandle] } }
  }

  if (doc.type === "task") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    return { channels: ["tasks"], grant: { public: ["tasks"] } }
  }

  if (doc.type === "signup") {
    if (doc.userHandle !== user.userHandle) throw { forbidden: "not author" }
    ctx.requireRole("volunteers")
    return { channels: ["tasks"] }
  }

  return {}
}