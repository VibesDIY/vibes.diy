// Trip document (singleton-ish): only owner can create/edit trip metadata.
// Itinerary activities and packing items: any signed-in user can add their own;
// any signed-in user can check off packing items (toggle 'checked' field).
// Everything is public-read within the vibe so collaborators see each other.
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to plan the trip" }

  if (doc.type === "trip") {
    if (!user.isOwner) throw { forbidden: "only the trip owner can edit trip details" }
    return { channels: ["trip"], grant: { public: ["trip"] } }
  }

  if (doc.type === "activity") {
    // Anyone signed in can add an activity; only author or owner can edit/delete
    if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only the author or trip owner can edit this activity" }
    }
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match you" }
    }
    return { channels: ["trip"], grant: { public: ["trip"] } }
  }

  if (doc.type === "packing") {
    // Anyone signed in can add or check off packing items
    if (!oldDoc && doc.authorHandle !== user.userHandle) {
      throw { forbidden: "authorHandle must match you" }
    }
    return { channels: ["trip"], grant: { public: ["trip"] } }
  }

  throw { forbidden: "unknown document type" }
}