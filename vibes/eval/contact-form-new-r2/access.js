// Anyone (including anonymous visitors) can submit a contact request — that's the whole point of a contact form.
// Only the owner can update requests (mark contacted, archive). Non-owners cannot read the request list.
export default function (doc, oldDoc, user, ctx) {
  if (doc.type === "request") {
    // New submissions: open to anonymous via allowAnonymous; no edits to existing requests except by owner.
    if (oldDoc) {
      if (!user?.isOwner) throw { forbidden: "owner only" };
      return { channels: ["owner-inbox"] };
    }
    return { channels: ["owner-inbox"], allowAnonymous: true };
  }
  if (!user) throw { forbidden: "sign in" };
  return {};
}

// Grant owner-inbox read access to the owner via a singleton config doc the owner writes once.
// Simpler: the owner is always implicitly granted everything, so no explicit grant needed here.
