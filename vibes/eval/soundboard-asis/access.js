// Only the owner can change kit settings or assign sounds to pads.
// Anyone signed in can read — non-owners see the current board live but can't edit.
// Tapping pads is a local audio action, not a write, so viewers can jam without permissions.
export function neonPads(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to view the board" };
  if (doc.type === "pad" || doc.type === "settings") {
    if (!user.isOwner) throw { forbidden: "owner only" };
  }
  return {};
}
