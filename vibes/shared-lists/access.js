// Per-object hybrid: each list owns a channel "list:<id>" (its data) plus
// "list:<id>/admin" (who may invite). Creator is sole admin; members have full
// read/write on items. See the spec for the full rationale and the immutable-field
// discipline. The export name MUST match the database name ("sharedLists").

const SAFE_ID = /^[A-Za-z0-9_-]+$/;
function safeId(id) {
  if (typeof id !== "string" || !SAFE_ID.test(id)) throw { forbidden: "Invalid id" };
  return id;
}

export function sharedLists(doc, oldDoc, user, ctx) {
  if (!user?.userHandle) throw { forbidden: "Sign in to make changes" };
  if (oldDoc && doc.type !== oldDoc.type) throw { forbidden: "type is immutable" };

  switch (doc.type) {
    case "list": {
      const chan = "list:" + safeId(doc._id);
      if (oldDoc) {
        if (doc.creatorHandle !== oldDoc.creatorHandle) throw { forbidden: "creatorHandle is immutable" };
        ctx.requireAccess(chan + "/admin");
      } else if (doc.creatorHandle !== user.userHandle) {
        throw { forbidden: "You must be the creator" };
      }
      return { channels: [chan], grant: { users: { [doc.creatorHandle]: [chan, chan + "/admin"] } } };
    }
    case "item": {
      const chan = "list:" + safeId(oldDoc ? oldDoc.listId : doc.listId);
      ctx.requireAccess(chan);
      if (oldDoc) {
        if (doc.listId !== oldDoc.listId) throw { forbidden: "listId is immutable" };
        if (doc.authorHandle !== oldDoc.authorHandle) throw { forbidden: "authorHandle is immutable" };
      } else if (doc.authorHandle !== user.userHandle) {
        throw { forbidden: "authorHandle must be you" };
      }
      return { channels: [chan] };
    }
    case "member": {
      const chan = "list:" + safeId(doc.listId);
      ctx.requireAccess(chan + "/admin");
      if (oldDoc) throw { forbidden: "Membership grants are immutable" };
      if (doc.addedBy !== user.userHandle) throw { forbidden: "addedBy must be you" };
      return { channels: [chan], grant: { users: { [doc.userHandle]: [chan] } } };
    }
    default:
      throw { forbidden: "Unknown doc type" };
  }
}
