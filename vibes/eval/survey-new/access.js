// Pulse permission model:
// - "response" docs: anyone (incl. anonymous visitors) can submit ONCE. Write-once,
//   no edits, no deletes by author. Routed to "responses" channel. Only team
//   members with the "reviewer" role (granted via roleGrant docs by the owner)
//   can read them.
// - "roleGrant" docs: owner-only. Adds a userHandle to the "reviewer" role and
//   grants that role access to the "responses" channel.
// - "summary" doc: owner-only. When published:true, granted public read so
//   visitors see it on the summary page. Drafts stay private to the owner.
export default function (doc, oldDoc, user, ctx) {
  if (doc.type === "response") {
    if (oldDoc) throw { forbidden: "responses are write-once" };
    return { channels: ["responses"], allowAnonymous: true };
  }
  if (doc.type === "roleGrant") {
    if (!user) throw { forbidden: "sign in" };
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {
      members: { reviewer: [doc.userHandle] },
      grant: { roles: { reviewer: ["responses"] } },
    };
  }
  if (doc.type === "summary") {
    if (!user) throw { forbidden: "sign in" };
    if (!user.isOwner) throw { forbidden: "owner only" };
    const grant = {};
    if (doc.published) grant.public = [doc._id];
    return { channels: [doc._id], grant };
  }
  if (!user) throw { forbidden: "sign in" };
  return {};
}
