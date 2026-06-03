// Portrait docs: any signed-in user can create their own; authorHandle must match.
// All portraits are publicly readable so the party wall shows everyone's work.
export function dreamJobs(doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to post a portrait" };
  if (doc.type === "portrait") {
    if (doc.authorHandle !== user.userHandle) throw { forbidden: "you can only create your own portrait" };
    if (oldDoc && oldDoc.authorHandle !== user.userHandle) throw { forbidden: "you can only edit your own portrait" };
    return { channels: ["wall"], grant: { public: ["wall"] } };
  }
  return {};
}
