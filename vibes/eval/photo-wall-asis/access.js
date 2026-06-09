// Images are owned by their uploader.
// Anyone signed in can upload; only the author (or owner) can edit tags/caption.
// All images are publicly readable to members of the app.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to contribute" };
  if (doc.type === "image") {
    if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only the author can edit this image" };
    }
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match you" };
    }
  }
  return {};
}
