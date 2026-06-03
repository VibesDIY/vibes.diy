// snackSheet database:
// - "game" docs: only the owner (coach) can create, edit, or delete games.
// - "claim" docs: any signed-in parent can create a claim for an unclaimed game.
//   Parents can only edit/delete their own claims (matched by claimedBy === userHandle).
//   The coach (owner) can override any claim.
export function snackSheet(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };

  if (doc.type === "game") {
    if (!user.isOwner) throw { forbidden: "coach only" };
    return {};
  }

  if (doc.type === "claim") {
    if (user.isOwner) return {};
    if (!oldDoc) {
      // creating: must stamp self as claimedBy
      if (doc.claimedBy !== user.userHandle) throw { forbidden: "must claim as yourself" };
      return {};
    }
    // editing existing claim: only original claimant
    if (oldDoc.claimedBy !== user.userHandle) throw { forbidden: "not your claim" };
    return {};
  }

  return {};
}
