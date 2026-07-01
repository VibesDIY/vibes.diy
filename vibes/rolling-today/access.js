export default function (doc, oldDoc, user, ctx) {
  // Deletes arrive as tombstones that may not carry the original fields, so read
  // type/owner from oldDoc as a fallback.
  const type = doc.type || (oldDoc && oldDoc.type);
  const ownerId = doc.userId != null ? doc.userId : oldDoc && oldDoc.userId;

  // Every write needs a real account. Logged-out favorites/notes never reach the
  // cloud — they live in localStorage and migrate in on first sign-in.
  if (!user) throw { forbidden: "authentication required" };

  // Favorites are public-read (cheap to serve the "friends rolling" piles), but the
  // app only *displays* your own + your friends' picks. Owner-only writes.
  if (type === "favorite") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    return { channels: ["favorites"], grant: { public: ["favorites"] } };
  }

  // Notes are private to their owner.
  if (type === "note") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const ch = `user-${ownerId}`;
    return { channels: [ch], grant: { users: { [ownerId]: [ch] } } };
  }

  // A friend edge is visible to both endpoints so following resolves in both
  // directions.
  if (type === "friend") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const friendSlug = doc.friendSlug != null ? doc.friendSlug : oldDoc && oldDoc.friendSlug;
    const myChannel = `user-${ownerId}`;
    const theirChannel = `user-${friendSlug}`;
    return {
      channels: [myChannel, theirChannel],
      grant: { users: { [ownerId]: [myChannel], [friendSlug]: [theirChannel] } },
    };
  }

  // Unknown / legacy doc types (e.g. `geocode` docs from the old map): accept the
  // write but route it to an unreadable channel — one with no grant, so nobody can
  // read it back. Throwing here would surface as an error toast and, worse, fail the
  // whole anonymousLocal migration on every load if a single stray doc slips through.
  return { channels: ["discard"], grant: {} };
}
