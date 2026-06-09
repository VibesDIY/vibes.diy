export function picker(doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "authentication required" };

  if (doc.type === "favorite") {
    if (doc.userId !== user.userHandle) throw { forbidden: "not owner" };
    return {
      channels: ["favorites"],
      grant: { public: ["favorites"] },
    };
  }

  if (doc.type === "note") {
    if (doc.userId !== user.userHandle) throw { forbidden: "not owner" };
    const ch = `user-${doc.userId}`;
    return {
      channels: [ch],
      grant: { users: { [doc.userId]: [ch] } },
    };
  }

  if (doc.type === "shift") {
    if (doc.userId !== user.userHandle) throw { forbidden: "not owner" };
    const ch = `user-${doc.userId}`;
    return {
      channels: [ch],
      grant: { users: { [doc.userId]: [ch] } },
    };
  }

  if (doc.type === "friend") {
    if (doc.userId !== user.userHandle) throw { forbidden: "not owner" };
    const myChannel = `user-${doc.userId}`;
    const theirChannel = `user-${doc.friendSlug}`;
    return {
      channels: [myChannel, theirChannel],
      grant: {
        users: {
          [doc.userId]: [myChannel],
          [doc.friendSlug]: [theirChannel],
        },
      },
    };
  }

  return {};
}
