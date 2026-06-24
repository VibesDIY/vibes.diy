// Each user's todos are private — one channel per user holds all their items.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to use slam list" };
  if (doc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
  if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "not author" };
  const mine = `user:${user.userHandle}`;
  return { channels: [mine], grant: { users: { [user.userHandle]: [mine] } } };
}
