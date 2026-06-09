// FlowBoard permissions:
// - Only the owner can create, edit, move, or delete cards.
// - Everyone (signed in or not) can read all cards — live spectator mode.
// - allowAnonymous lets non-signed-in visitors read; writes still require owner.
export default function (doc, oldDoc, user, ctx) {
  if (!user) {
    // Anonymous read-only — no writes allowed via this path
    throw { forbidden: "sign in required to write" };
  }
  if (doc.type === "card") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  return {};
}
