// Lists and tasks both require sign-in. Authors are stamped via createdBy and
// can only edit their own docs. No channels needed — this is a single shared
// workspace where everyone sees everything (Fireproof sync handles the rest).
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to edit" };
  if (oldDoc && oldDoc.createdBy && oldDoc.createdBy !== user.userHandle) {
    throw { forbidden: "only the author can edit" };
  }
  return {};
}
