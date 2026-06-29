// Hot Takes access function.
// One shared "board" channel everyone reads. Owner controls write access via grants.
// - The owner bootstraps the board by writing a "boardConfig" doc that grants
//   public read on "board" and write access to whoever they list.
// - Any signed-in user listed in the config can post takes and update verdicts.
// - Non-members see the board read-only (public channel grant).
export default function (doc, oldDoc, user, ctx) {
  if (!user) throw { forbidden: "sign in" }

  if (doc.type === "boardConfig") {
    if (!user.isOwner) throw { forbidden: "owner only" }
    const writers = Array.isArray(doc.writers) ? doc.writers : []
    return {
      channels: ["board"],
      grant: {
        public: ["board"],
        users: Object.fromEntries(writers.map(h => [h, ["board"]])),
      },
    }
  }

  if (doc.type === "take") {
    // Original author or owner can update verdict; anyone with channel write can post new takes.
    if (oldDoc && oldDoc.authorHandle !== user.userHandle && !user.isOwner) {
      throw { forbidden: "only author or owner can edit" }
    }
    ctx.requireAccess("board")
    return { channels: ["board"] }
  }

  throw { forbidden: "unknown document type" }
}