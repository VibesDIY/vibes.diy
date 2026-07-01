export default function (doc, oldDoc, user, ctx) {
  // Deletes arrive as tombstones that may not carry the original fields, so read
  // type/owner from oldDoc as a fallback to keep favorite removal working.
  const type = doc.type || (oldDoc && oldDoc.type);
  const ownerId = doc.userId != null ? doc.userId : oldDoc && oldDoc.userId;

  if (type === "favorite") {
    // Favorites are public and may be saved (or removed) by anyone, including
    // logged-out visitors — an anon user owns theirs via a client-minted device
    // id in doc.userId. Signed-in users must match their own handle; anonymous
    // writes are opted in explicitly with allowAnonymous.
    if (user && ownerId !== user.userHandle) throw { forbidden: "not owner" };
    return {
      channels: ["favorites"],
      grant: { public: ["favorites"] },
      allowAnonymous: true,
    };
  }

  // Everything below (private notes, work shifts, friend links) needs a real
  // account — these route to per-user channels only a signed-in handle can read.
  if (!user) throw { forbidden: "authentication required" };

  if (type === "note") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const ch = `user-${ownerId}`;
    return {
      channels: [ch],
      grant: { users: { [ownerId]: [ch] } },
    };
  }

  if (type === "shift") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const ch = `user-${ownerId}`;
    return {
      channels: [ch],
      grant: { users: { [ownerId]: [ch] } },
    };
  }

  if (type === "friend") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    const friendSlug = doc.friendSlug != null ? doc.friendSlug : oldDoc && oldDoc.friendSlug;
    const myChannel = `user-${ownerId}`;
    const theirChannel = `user-${friendSlug}`;
    return {
      channels: [myChannel, theirChannel],
      grant: {
        users: {
          [ownerId]: [myChannel],
          [friendSlug]: [theirChannel],
        },
      },
    };
  }

  throw { forbidden: "unknown document type" };
}
