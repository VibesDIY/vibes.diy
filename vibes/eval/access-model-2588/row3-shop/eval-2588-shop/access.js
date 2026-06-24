// Shared list: owner creates the list channel (public read) so invitees see it;
// any signed-in user posts/edits/deletes items. Item author is stamped and
// preserved on updates. The owner's runtime sharing settings (public toggle,
// allowed-user list) decide who actually reaches the app — access.js stays open
// to "any signed-in member" so partners get full edit rights automatically.
export function cartSync(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" }

  if (doc.type === "item") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author on create" }
    // Anyone signed-in can edit/check-off/delete any item — it's a shared list.
    return { channels: ["list"], grant: { public: ["list"] } }
  }

  throw { forbidden: "unknown document type" }
}