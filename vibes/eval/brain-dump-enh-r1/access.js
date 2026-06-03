// Two databases:
//   "brainDumps" — owner-only private workspace, no sharing
//   "sharedLists" — owner publishes lists here; public channel makes them readable to all members
export function brainDumps(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (!user.isOwner) throw { forbidden: "owner only" };
  return {};
}

export function sharedLists(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (!user.isOwner) throw { forbidden: "owner only" };
  // Every shared list goes into the "team" channel, granted public read to all members
  return { channels: ["team"], grant: { public: ["team"] } };
}
