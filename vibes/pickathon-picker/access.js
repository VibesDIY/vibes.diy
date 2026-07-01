export default function (doc, oldDoc, user, ctx) {
  // Deletes arrive as tombstones that may not carry the original fields, so read
  // type/owner from oldDoc as a fallback to keep favorite removal working.
  const type = doc.type || (oldDoc && oldDoc.type);
  const ownerId = doc.userId != null ? doc.userId : oldDoc && oldDoc.userId;

  // All writes need a real account. Logged-out favorites never reach Fireproof —
  // they live in the browser's localStorage and are migrated in on first sign-in.
  if (!user) throw { forbidden: "authentication required" };

  if (type === "favorite") {
    if (ownerId !== user.userHandle) throw { forbidden: "not owner" };
    // Public read so super mode can show global pick counts and peer picks.
    return { channels: ["favorites"], grant: { public: ["favorites"] } };
  }

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
