// Only the owner can create hat entries. Anyone can read them (public gallery).
// Hats are stored in a single channel "cabinet" that's publicly readable.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" }
  if (doc.type === "hat") {
    if (!user.isOwner) throw { forbidden: "only the curator may submit hats" }
    return { channels: ["cabinet"], grant: { public: ["cabinet"] } }
  }
  return {}
}