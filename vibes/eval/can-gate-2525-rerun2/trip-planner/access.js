// Wanderlist permission model:
// - "trip" doc (singleton, _id="trip:current"): owner only — sets destination & dates
// - "day" doc: any signed-in member adds activities to a day; only original author edits
// - "packItem" doc: any signed-in member adds; any signed-in member can toggle `packed` (collaborative checkoff)
// All docs route to the public "trip" channel so every member sees them; grant.public makes the channel readable to all members.
export function wanderlist(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in to plan" };

  if (doc.type === "trip") {
    if (!user.isOwner) throw { forbidden: "only the trip owner can set destination" };
    return { channels: ["trip"], grant: { public: ["trip"] } };
  }

  if (doc.type === "day") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
    return { channels: ["trip"] };
  }

  if (doc.type === "packItem") {
    // Anyone can create; anyone can toggle `packed`; author preserved on other edits
    if (oldDoc && oldDoc.authorHandle !== doc.authorHandle) throw { forbidden: "author immutable" };
    return { channels: ["trip"] };
  }

  throw { forbidden: "unknown document type" };
}
