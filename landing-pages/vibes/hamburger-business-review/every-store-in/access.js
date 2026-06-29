// Doc types:
//   expedition: chain+city pick. Owner-only. Public read in channel "edition".
//   location:   AI-generated roster entry. Owner-only writes. Public read.
//   visit:      a logged visit. Any signed-in user can write their own; public read.
// Everything lives in channel "edition" so the leaderboard sees all reporters.
export default function (doc, oldDoc, user) {
  if (!user) throw { forbidden: "sign in to report" }
  if (doc.type === "expedition" || doc.type === "location") {
    if (!user.isOwner) throw { forbidden: "editor-in-chief only" }
    return { channels: ["edition"], grant: { public: ["edition"] } }
  }
  if (doc.type === "visit") {
    if (doc.reporterHandle !== user.userHandle) throw { forbidden: "not reporter" }
    if (oldDoc && oldDoc.reporterHandle !== user.userHandle) throw { forbidden: "not reporter" }
    return { channels: ["edition"] }
  }
  throw { forbidden: "unknown document type" }
}