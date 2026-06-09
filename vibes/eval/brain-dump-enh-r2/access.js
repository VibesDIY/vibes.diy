// Dumps are owner-private: only the owner writes, and they're not granted to anyone else.
// Lists are owner-written; when shared=true they're granted to the public channel "team",
// so all members (anyone with a vibe grant) can read them. Private lists stay owner-only.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "dump") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  if (doc.type === "list") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    if (doc.shared) {
      return { channels: ["team"], grant: { public: ["team"] } };
    }
    return {};
  }
  return {};
}
