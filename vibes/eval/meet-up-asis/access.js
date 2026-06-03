// schedule docs: pasted availability text for person A or B. Owner-only writes.
// result docs: AI-generated overlap analyses. Owner-only writes; everyone reads.
// All docs are public-read so non-owner viewers see the live feed.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in" };
  if (doc.type === "schedule" || doc.type === "result") {
    if (!user.isOwner) throw { forbidden: "owner only" };
    return {};
  }
  return {};
}
