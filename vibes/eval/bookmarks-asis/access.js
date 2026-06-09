// Bookmarks app — owner-controlled archive, public read.
// - Only the vibe owner can create, edit, or delete bookmarks.
// - All members (signed in via the runtime) can read everything via grant.public.
// - Anonymous reads are governed by the platform's app-level public toggle.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "bookmark") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return { channels: ["vault"], grant: { public: ["vault"] } };
  }
  return {};
}
